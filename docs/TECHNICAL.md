# Volako Mobile — Documentation Technique

## Vue d'ensemble

**Volako Mobile** est l'application mobile (React Native / Expo) de gestion de finances personnelles Volako. Elle reproduit toutes les fonctionnalités de la version web (Next.js) tout en ajoutant une capacité de fonctionnement **hors ligne** et une **synchronisation cloud** via Firebase.

- **Plateforme** : Android & iOS (via Expo)
- **Framework** : React Native 0.74 + Expo SDK 51
- **Langage** : TypeScript 5.3
- **Navigation** : React Navigation 6 (Bottom Tabs + Native Stack)
- **Backend** : Firebase (Auth + Firestore)
- **Stockage local** : AsyncStorage (offline-first)
- **Icônes** : @expo/vector-icons (Ionicons)

---

## Architecture

```
mobile/
├── App.tsx                    # Point d'entrée — providers + navigation
├── app.json                    # Configuration Expo
├── babel.config.js            # Babel (preset Expo)
├── tsconfig.json              # Configuration TypeScript
├── package.json               # Dépendances & scripts
├── .env.example               # Variables Firebase à configurer
├── docs/
│   └── TECHNICAL.md           # Cette documentation
└── src/
    ├── types/
    │   └── index.ts           # Types & interfaces (Account, Transaction, etc.)
    ├── lib/
    │   ├── firebase.ts        # Initialisation Firebase (Auth + Firestore)
    │   ├── storage.ts         # Couche AsyncStorage (CRUD local + file d'attente)
    │   ├── sync.ts            # Moteur de synchronisation Firestore ↔ AsyncStorage
    │   ├── repository.ts      # Pattern Repository (CRUD unifié par entité)
    │   └── formatters.ts      # Formatage devise, dates, génération d'IDs
    ├── context/
    │   ├── AuthContext.tsx     # Auth Firebase + seed données initiales
    │   └── SettingsContext.tsx # Préférences utilisateur (devise, thème)
    ├── navigation/
    │   └── AppNavigator.tsx   # Navigation principale (tabs + stack)
    ├── components/
    │   ├── theme.ts            # Palette de couleurs (clair + sombre)
    │   └── ui.tsx              # Composants UI réutilisables
    └── screens/
        ├── LoginScreen.tsx
        ├── DashboardScreen.tsx
        ├── TransactionsScreen.tsx
        ├── AccountsScreen.tsx
        ├── BudgetScreen.tsx
        ├── GoalsScreen.tsx
        ├── CategoriesScreen.tsx
        ├── ReportsScreen.tsx
        ├── RecurringScreen.tsx
        ├── SimulationScreen.tsx
        ├── SettingsScreen.tsx
        └── MoreMenu.tsx
```

---

## Stratégie Offline-First

### Principe

L'application est conçue pour fonctionner **même sans connexion internet**. Toutes les opérations de lecture/écriture passent d'abord par le stockage local (AsyncStorage), puis sont synchronisées avec Firebase Firestore en arrière-plan.

### Flux de données

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Écran UI   │────▶│  Repository      │────▶│ AsyncStorage │
│              │     │  (create/update/ │     │  (stockage   │
│              │◀────│   delete/get)    │◀────│  local)      │
└──────────────┘     └────────┬─────────┘     └─────────────┘
                              │
                              ▼
                     ┌────────────────┐
                     │  Sync Engine  │
                     │  (push/pull/  │
                     │   flush queue) │
                     └───────┬────────┘
                             │
                     ┌───────▼────────┐
                     │  Firestore     │
                     │  (cloud)       │
                     └────────────────┘
```

### 1. Écriture (create / update / delete)

1. L'opération est **immédiatement** écrite dans AsyncStorage (latence ~0ms).
2. Une tentative de **push vers Firestore** est effectuée.
3. Si le push échoue (hors ligne), l'opération est ajoutée à une **file d'attente** (`sync_queue`) stockée dans AsyncStorage.
4. L'item local est marqué `_synced: false` jusqu'à confirmation cloud.

### 2. Lecture (get all)

Les données sont lues **directement depuis AsyncStorage**, garantissant une réponse instantanée même hors ligne.

### 3. Synchronisation (pull)

Au démarrage de l'app ou à la reconnexion :
- `pullAllData()` récupère toutes les collections depuis Firestore.
- Les données distantes **écrasent** les données locales synchronisées.
- Les données locales **non synchronisées** (créées hors ligne) sont **préservées**.
- `flushSyncQueue()` rejoue les opérations en file d'attente.

### 4. File d'attente (`sync_queue`)

Chaque opération échouée est stockée avec :
- `collection` : nom de la collection
- `type` : `create` | `update` | `delete`
- `docId` : ID du document
- `data` : payload (pour create/update)
- `timestamp` : horodatage

---

## Modèle de données

### Collections Firestore

Les données sont organisées par utilisateur :

```
users/{userId}/accounts/{accountId}
users/{userId}/categories/{categoryId}
users/{userId}/transactions/{transactionId}
users/{userId}/budgets/{budgetId}
users/{userId}/goals/{goalId}
users/{userId}/goal_contributions/{contributionId}
users/{userId}/recurring_transactions/{recurringId}
users/{userId}/simulations/{simulationId}
users/{userId}/simulation_items/{itemId}
users/{userId}/notifications/{notificationId}
users/{userId}/settings/{settingsId}
```

### Types TypeScript

| Type | Description |
|------|-------------|
| `Account` | Compte bancaire, espèces, mobile money |
| `Category` | Catégorie de revenu ou dépense |
| `Transaction` | Transaction financière (revenu/dépense) |
| `Budget` | Budget mensuel par catégorie |
| `Goal` | Objectif d'épargne |
| `GoalContribution` | Dépôt vers un objectif |
| `RecurringTransaction` | Transaction récurrente |
| `Simulation` | Scénario hypothétique |
| `SimulationItem` | Élément d'une simulation |
| `Notification` | Notification in-app |
| `Settings` | Préférences utilisateur |

Tous les types sont définis dans `src/types/index.ts`.

---

## Authentification

### Firebase Auth (email / mot de passe)

- **Inscription** : `createUserWithEmailAndPassword()` + `updateProfile()` pour le nom.
- **Connexion** : `signInWithEmailAndPassword()`.
- **Déconnexion** : `signOut()` + purge des données locales (`clearAllData`).

### Seed de données initiales

À la première connexion, l'application crée automatiquement :
- Un paramétrage par défaut (devise : Ariary, thème : système)
- Un compte "Espèces" par défaut
- 21 catégories par défaut (6 revenus + 15 dépenses)

Voir `AuthContext.tsx` → `seedUserData()`.

---

## Navigation

### Structure

```
Stack Navigator
├── Login (si non authentifié)
└── Main (si authentifié)
    └── Bottom Tabs
        ├── Accueil        → DashboardScreen
        ├── Transactions   → TransactionsScreen
        ├── Comptes        → AccountsScreen
        ├── Rapports        → ReportsScreen
        └── Plus           → MoreStack
                            ├── MoreMenu
                            ├── Budget
                            ├── Goals
                            ├── Categories
                            ├── Recurring
                            ├── Simulation
                            └── Settings
```

---

## Composants UI

Les composants réutilisables sont dans `src/components/ui.tsx` :

| Composant | Description |
|-----------|-------------|
| `Card` | Conteneur avec bordure arrondie |
| `Button` | Bouton (primary / outline / ghost / destructive) |
| `Input` | Champ texte avec label et erreur |
| `Select` | Sélecteur de boutons (segmented) |
| `Dropdown` | Liste déroulante |
| `Modal` | Fenêtre modale plein écran |
| `Badge` | Étiquette colorée |
| `ProgressBar` | Barre de progression |
| `EmptyState` | État vide |
| `LoadingSpinner` | Indicateur de chargement |

---

## Configuration

### 1. Variables d'environnement

Copier `.env.example` en `.env` et remplir avec les valeurs Firebase :

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
EXPO_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:abcdef
```

### 2. Configuration Firebase

1. Créer un projet sur [Firebase Console](https://console.firebase.google.com)
2. Activer **Authentication** → Sign-in method → **Email/Password**
3. Créer une **Web App** et récupérer la configuration
4. Activer **Cloud Firestore** en mode production
5. Configurer les règles Firestore :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 3. Installation et lancement

```bash
cd mobile
npm install
cp .env.example .env  # puis éditer avec vos valeurs Firebase
npx expo start        # lance le serveur de dev
```

Pour lancer sur un appareil :
```bash
npx expo start --android   # émulateur Android
npx expo start --ios       # simulateur iOS
```

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Démarre le serveur Expo |
| `npm run android` | Lance sur Android |
| `npm run ios` | Lance sur iOS |
| `npm run web` | Lance sur le web |
| `npm run typecheck` | Vérification TypeScript |
| `npm run lint` | Lint ESLint |

---

## Fonctionnalités

### Gestion des transactions
- Création, modification, suppression de transactions
- Filtrage par type (revenu/dépense) et recherche par texte
- Association à un compte et une catégorie
- Calcul automatique du solde du compte

### Gestion des comptes
- Comptes de type banque, espèces, mobile money, épargne
- Solde calculé automatiquement à partir des transactions
- Personnalisation de couleur

### Budgets
- Budget mensuel par catégorie
- Suivi des dépenses vs budget
- Barre de progression visuelle

### Objectifs d'épargne
- Création d'objectifs avec montant cible et échéance
- Dépôts progressifs (contributions)
- Marquage automatique comme "atteint"

### Catégories
- Catégories de revenus et de dépenses
- 21 catégories par défaut pré-remplies
- Personnalisation (nom, couleur, type)

### Transactions récurrentes
- Création de règles (quotidien, hebdomadaire, mensuel, annuel)
- Activation/désactivation
- Date de prochaine exécution

### Simulations
- Scénarios hypothétiques "what-if"
- Solde initial + éléments projetés
- Calcul du solde final
- N'affecte pas les données réelles

### Rapports
- Synthèse revenus/dépenses du mois
- Tendance sur 6 mois (graphique en barres)
- Répartition des dépenses par catégorie

### Paramètres
- Choix de la devise (Ariary, Euro, Dollar, FCFA)
- Choix du thème (système, clair, sombre)
- Déconnexion

---

## Sécurité

- **Authentification** : Firebase Auth (email/mot de passe)
- **Règles Firestore** : chaque utilisateur ne peut accéder qu'à ses propres données (`users/{userId}/...`)
- **Stockage local** : les données sont isolées par application (sandbox AsyncStorage)
- **Purge au logout** : `clearAllData()` supprime toutes les données locales à la déconnexion

---

## Comparaison avec la version Web

| Aspect | Web (Next.js) | Mobile (React Native) |
|--------|---------------|----------------------|
| Backend | Supabase (PostgreSQL + RLS) | Firebase (Firestore) |
| Auth | Supabase Auth | Firebase Auth |
| Stockage | Postgres | AsyncStorage (offline) + Firestore (cloud) |
| UI | shadcn/ui + Tailwind | Composants natifs custom |
| Graphiques | Recharts | Barres natives + ProgressBar |
| Offline | Non | Oui (offline-first) |
| Sync | Temps réel (Supabase) | Pull/push + file d'attente |

---

## Dépendances principales

| Package | Version | Rôle |
|---------|---------|------|
| `expo` | ~51.0.28 | Framework |
| `react-native` | 0.74.5 | Runtime |
| `firebase` | ^10.12.5 | Backend (Auth + Firestore) |
| `@react-native-async-storage/async-storage` | 1.23.1 | Stockage local |
| `@react-navigation/native` | ^6.1.18 | Navigation |
| `@react-navigation/bottom-tabs` | ^6.6.1 | Onglets |
| `@react-navigation/native-stack` | ^6.1.0 | Pile d'écrans |
| `react-native-safe-area-context` | 4.10.5 | Zones sûres |
| `@expo/vector-icons` | ^14.0.2 | Icônes |
| `date-fns` | ^3.6.0 | Manipulation de dates |

---

## Limitations connues

1. **Pas de sync en temps réel** : la synchronisation se fait au démarrage et après chaque opération, pas via des listeners Firestore en temps réel (pour économiser la batterie).
2. **Pas de gestion des conflits** : en cas de modifications concurrentes sur deux appareils, la dernière écriture Firestore gagne (Last Write Wins).
3. **Pas de upload de pièces jointes** : le champ `attachment_url` existe mais l'upload de fichiers n'est pas implémenté dans cette version.
4. **Graphiques simplifiés** : les graphiques utilisent des vues natives (barres) plutôt qu'une librairie de charting complète pour des performances optimales sur mobile.

---

## Évolutions futures

- Sync en temps réel via Firestore `onSnapshot()`
- Upload de reçus/pièces jointes vers Firebase Storage
- Notifications push via Firebase Cloud Messaging
- Export de données (CSV / PDF)
- Mode multi-devise avec conversion automatique
- Authentification biométrique (FaceID / TouchID)
