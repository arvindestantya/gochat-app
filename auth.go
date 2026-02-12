package main

import (
	"encoding/json"
	"net/http"

	"golang.org/x/crypto/bcrypt"
)

// Struct untuk menampung data dari Frontend
type Credentials struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// 1. REGISTER (Bikin Akun Baru)
func Register(w http.ResponseWriter, r *http.Request) {
	var creds Credentials
	// Baca JSON dari frontend
	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		http.Error(w, "Invalid request", 400)
		return
	}

	// Hash Password (Acak-acak password biar aman)
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(creds.Password), 14)
	if err != nil {
		http.Error(w, "Gagal hash password", 500)
		return
	}

	// Simpan ke Database
	user := User{Username: creds.Username, Password: string(hashedPassword)}
	result := DB.Create(&user)

	if result.Error != nil {
		http.Error(w, "Username sudah dipakai!", 400)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Registrasi Berhasil"))
}

// 2. LOGIN (Masuk Akun)
func Login(w http.ResponseWriter, r *http.Request) {
	var creds Credentials
	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		http.Error(w, "Invalid request", 400)
		return
	}

	// Cari user di database
	var user User
	result := DB.Where("username = ?", creds.Username).First(&user)
	if result.Error != nil {
		http.Error(w, "User tidak ditemukan", 404)
		return
	}

	// Cek Password (Bandingkan hash di DB dengan input user)
	err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(creds.Password))
	if err != nil {
		http.Error(w, "Password salah!", 401)
		return
	}

	// Sukses!
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Login Sukses"))
}
