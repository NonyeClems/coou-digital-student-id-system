import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import { Student } from "../types";
import { normalizeRegNo, toDocId } from "./utils";

/**
 * Data-access layer for the `students` collection.
 *
 * The registration number is the primary identifier: every record's document
 * ID is `toDocId(registrationNumber)`. Because document IDs are deterministic,
 * a write queued offline and replayed during synchronization always lands on
 * the same document — duplicates cannot be created by the sync process itself.
 *
 * All writes are offline-aware: with Firestore's persistent cache enabled
 * (see lib/firebase.ts) a write made offline is stored durably and pushed to
 * the server automatically when connectivity returns. `saveStudent` /
 * `removeStudent` report whether the server has acknowledged the write
 * (`synced: true`) or whether it is queued locally (`synced: false`).
 */

const studentsCol = () => collection(db, "students");

export function studentDocRef(regNoOrDocId: string) {
  return doc(db, "students", toDocId(regNoOrDocId));
}

/** How long a write may take before we report it as "queued for sync". */
const SYNC_ACK_TIMEOUT_MS = 5000;

export interface SaveOutcome {
  /** true — acknowledged by the server; false — queued locally and will sync automatically. */
  synced: boolean;
}

async function raceServerAck(ack: Promise<unknown>): Promise<SaveOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const synced = await Promise.race([
    ack.then(() => true as const),
    new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), SYNC_ACK_TIMEOUT_MS);
    }),
  ]);
  clearTimeout(timer);
  if (!synced) {
    // The write lives in the persistent local queue. If the server rejects it
    // later (e.g. a security-rule denial once back online), surface it in the
    // console — the caller's UI has already reported "queued for sync".
    ack.catch((err) =>
      console.error(
        "[sync] A locally queued write was rejected by the server:",
        err,
      ),
    );
  }
  return { synced };
}

/** Creates or overwrites a student record (document ID = registration number). */
export function saveStudent(student: Student): Promise<SaveOutcome> {
  const docId = student.docId || toDocId(student.id);
  return raceServerAck(setDoc(studentDocRef(docId), { ...student, docId }));
}

/** Deletes a student record. Offline deletes are queued like writes. */
export function removeStudent(docId: string): Promise<SaveOutcome> {
  return raceServerAck(deleteDoc(studentDocRef(docId)));
}

/**
 * Looks a student up by registration number — the app's primary lookup.
 * Works offline when the record is in the local cache. Falls back to querying
 * the `id` field for legacy records whose document ID differs.
 */
export async function findStudentByRegNo(
  regNo: string,
): Promise<Student | null> {
  const normalized = normalizeRegNo(regNo);
  if (!normalized) return null;
  try {
    const snap = await getDoc(studentDocRef(normalized));
    if (snap.exists()) return { ...(snap.data() as Student), docId: snap.id };
  } catch {
    // Offline and not cached — fall through to the query, which resolves from
    // the cache without throwing.
  }

  try {
    const byIdField = await getDocs(
      query(studentsCol(), where("id", "==", normalized), limit(1)),
    );
    if (!byIdField.empty) {
      const d = byIdField.docs[0];
      return { ...(d.data() as Student), docId: d.id };
    }
  } catch (error) {
    if (error instanceof Error && /permission/i.test(error.message)) {
      console.error(
        "Student lookup by registration number failed due to permissions:",
        error,
      );
      throw error;
    }
    console.error("Student lookup by registration number failed:", error);
    return null;
  }

  return null;
}

export type RegNoAvailability = "free" | "taken" | "own" | "unknown";

/**
 * Duplicate-registration guard used by both registration workflows.
 * 'own' — the record exists but already belongs to `ownEmail` (re-enrollment).
 * 'unknown' — offline and the record is not cached, so availability cannot be
 * confirmed right now; the deterministic document ID still guarantees the
 * sync process cannot create a second record for the same number.
 */
export async function checkRegNoAvailability(
  regNo: string,
  ownEmail?: string | null,
): Promise<RegNoAvailability> {
  try {
    const snap = await getDoc(studentDocRef(regNo));
    if (!snap.exists()) return "free";
    const data = snap.data() as Student;
    return ownEmail && data.email === ownEmail ? "own" : "taken";
  } catch {
    return "unknown";
  }
}

export interface StudentRecordState {
  student: Student | null;
  /** The snapshot was served from the local cache (offline or still syncing). */
  fromCache: boolean;
  /** The record has local changes not yet acknowledged by the server. */
  pendingSync: boolean;
}

/**
 * Live subscription to a single student record by registration number.
 * Fires immediately from the cache when offline and again when the server
 * confirms, exposing cache/pending-sync state for the UI.
 */
export function subscribeToStudentByRegNo(
  regNo: string,
  onChange: (state: StudentRecordState) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    studentDocRef(regNo),
    { includeMetadataChanges: true },
    (snap) => {
      onChange({
        student: snap.exists()
          ? { ...(snap.data() as Student), docId: snap.id }
          : null,
        fromCache: snap.metadata.fromCache,
        pendingSync: snap.metadata.hasPendingWrites,
      });
    },
    onError,
  );
}

/** Live subscription to the student record bearing a given account email. */
export function subscribeToStudentByEmail(
  email: string,
  onChange: (state: StudentRecordState) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(studentsCol(), where("email", "==", email), limit(1)),
    { includeMetadataChanges: true },
    (snap) => {
      const d = snap.docs[0];
      onChange({
        student: d ? { ...(d.data() as Student), docId: d.id } : null,
        fromCache: snap.metadata.fromCache,
        pendingSync: d
          ? d.metadata.hasPendingWrites
          : snap.metadata.hasPendingWrites,
      });
    },
    onError,
  );
}

export interface StudentListItem extends Student {
  pendingSync: boolean;
}

export interface StudentListState {
  students: StudentListItem[];
  fromCache: boolean;
}

/**
 * Live subscription to the full registry (admin dashboard), newest first.
 * Serves the cached list when offline; queued local writes appear immediately
 * flagged with `pendingSync` until the server acknowledges them.
 */
export function subscribeToAllStudents(
  onChange: (state: StudentListState) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(studentsCol(), orderBy("createdAt", "desc")),
    { includeMetadataChanges: true },
    (snap) => {
      onChange({
        students: snap.docs.map((d) => ({
          ...(d.data() as Student),
          docId: d.id,
          pendingSync: d.metadata.hasPendingWrites,
        })),
        fromCache: snap.metadata.fromCache,
      });
    },
    onError,
  );
}
