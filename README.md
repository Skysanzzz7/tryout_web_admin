# Tryout Web Admin Panel

Aplikasi Web Admin untuk manajemen sistem **Tryout Ujian Online** yang terintegrasi penuh dengan Aplikasi Android siswa. Dilengkapi fitur **Real-time Sync**, **User Mapping**, dan **Export/Import Data**.

---

## Fitur Utama

- ✅ **Real-time Sync:** Hasil ujian dari Firebase Firestore otomatis masuk ke MySQL tanpa perlu refresh manual.
- ✅ **User Mapping:** Sinkronisasi profil pengguna (Nama & Email) dari Firebase Auth ke database lokal MySQL.
- ✅ **Anti-Duplicate Logic:** Sistem debounce & `INSERT IGNORE` mencegah data ganda saat sync.
- ✅ **Export to CSV:** Ekspor hasil ujian per paket atau seluruh data ke format Excel/CSV.
- ✅ **Responsive UI:** Desain modern menggunakan Tailwind CSS dengan animasi halus.
- ✅ **Secure Auth:** Proteksi endpoint backend menggunakan JWT Token.
- ✅ **Modular Structure:** Kode terpisah jelas antara Frontend (React) dan Backend (Node.js).

---

## 🛠️ Tech Stack

### **Frontend**
- React JS (Vite)
- Tailwind CSS
- Firebase SDK (Firestore Real-time Listener)
- Axios for API calls

### **Backend**
- Node.js & Express.js
- MySQL (via Laragon/XAMPP)
- Firebase Admin SDK (untuk server-side auth & firestore access)
- JSON Web Token (JWT) for authentication

### **Database**
- **MySQL:** Untuk data relasional (Users, Packages, Questions, Exam Results).
- **Firebase Firestore:** Untuk real-time sync hasil ujian dari aplikasi Android.

---

## 🚀 Cara Menjalankan Project

### **Prasyarat**
- Node.js v18+
- MySQL Server (Laragon/XAMPP)
- Akun Firebase Project

### **1. Setup Database MySQL**
Buat database baru bernama `tryout_db` di phpMyAdmin/HeidiSQL, lalu import struktur tabel dari file SQL yang disediakan (atau jalankan query schema manual).

### **2. Konfigurasi Backend**
cd backend
npm install

Buat file .env di folder backend/ dan isi konfigurasi database serta JWT secret.
Letakkan file serviceAccountKey.json dari Firebase di folder backend/config/.
  
Jalankan server:
- node server.js
Server akan berjalan di http://localhost:5000

### **3. Konfigurasi Frontend**
Pastikan file firebase.js di frontend/src/config/ sudah diisi dengan config Firebase project kamu.

Jalankan development server:
- npm run dev
Frontend akan berjalan di http://localhost:3000


### Integrasi dengan Android App ###
- Aplikasi ini dirancang untuk menerima data dari Tryout Android App.
- Siswa mengerjakan soal di Android → Data disimpan di Firebase Firestore.
- Web Admin mendeteksi perubahan via onSnapshot → Trigger sync ke MySQL.
- Data muncul otomatis di halaman Results dengan nama user yang benar.

# Author #
- Rayshan Januar Jibran Ramdani
- Email: rayshanjr05@gmail.com
