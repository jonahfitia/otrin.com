declare module 'firebase/app' {
  export interface FirebaseApp {}
  export function initializeApp(config: any): FirebaseApp;
}

declare module 'firebase/auth' {
  export interface User {
    uid: string;
    email: string | null;
    displayName: string | null;
  }
  export interface UserCredential {
    user: User;
  }
  export function getAuth(app?: any): any;
  export function createUserWithEmailAndPassword(auth: any, email: string, password: string): Promise<UserCredential>;
  export function signInWithEmailAndPassword(auth: any, email: string, password: string): Promise<UserCredential>;
  export function signOut(auth: any): Promise<void>;
  export function onAuthStateChanged(auth: any, callback: (user: User | null) => void): () => void;
  export function updateProfile(user: User, profile: { displayName?: string }): Promise<void>;
}

declare module 'firebase/firestore' {
  export function getFirestore(app?: any): any;
  export function collection(db: any, path: string): any;
  export function doc(db: any, ...pathSegments: string[]): any;
  export function setDoc(docRef: any, data: any, options?: { merge?: boolean }): Promise<void>;
  export function deleteDoc(docRef: any): Promise<void>;
  export function getDocs(query: any): Promise<{ forEach: (cb: (d: any) => void) => void }>;
  export function query(col: any, ...constraints: any[]): any;
  export function where(field: string, op: string, value: any): any;
  export function writeBatch(db: any): any;
}
