package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io" // <--- Baru
	"log"
	"net/http"
	"os" // <--- Baru

	// <--- Baru
	"time" // <--- Baru
)

func main() {
	flag.Parse()

	// 1. NYALAKAN DATABASE
	InitDB()
	os.MkdirAll("./uploads", os.ModePerm)
	http.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads"))))

	// 2. Route Upload
	http.HandleFunc("/upload", func(w http.ResponseWriter, r *http.Request) {
		// CORS Setup
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST")
		if r.Method == "OPTIONS" {
			return
		}
		uploadHandler(w, r)
	})

	hub := newHub()
	go hub.run()

	http.HandleFunc("/register", func(w http.ResponseWriter, r *http.Request) {
		// CORS (Agar frontend bisa akses)
		if r.Method == "OPTIONS" {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "POST")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			return
		}
		w.Header().Set("Access-Control-Allow-Origin", "*")
		Register(w, r)
	})

	http.HandleFunc("/login", func(w http.ResponseWriter, r *http.Request) {
		// CORS
		if r.Method == "OPTIONS" {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "POST")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			return
		}
		w.Header().Set("Access-Control-Allow-Origin", "*")
		Login(w, r)
	})

	// 2. ROUTE HISTORY (REST API)
	http.HandleFunc("/history", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Content-Type", "application/json")

		currentUser := r.URL.Query().Get("username")

		// --- LOGGING (CCTV) ---
		fmt.Printf("🔍 Cek History untuk user: '%s'\n", currentUser)
		// ----------------------

		var messages []Message

		// Query Filter
		// Logic: Tampilkan jika (Public) ATAU (Pesan Buat Saya) ATAU (Pesan Dari Saya)
		DB.Where("target = '' OR target = ? OR username = ?", currentUser, currentUser).Find(&messages)

		json.NewEncoder(w).Encode(messages)
	})

	// 3. ROUTE WEBSOCKET
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		serveWs(hub, w, r)
	})
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000" // Kalau di laptop (tidak ada PORT), pakai 3000
	}

	log.Println("Server Chat berjalan di port", port)
	// Ubah addr menjadi ":" + port
	log.Fatal(http.ListenAndServe(":"+port, nil))
}

func uploadHandler(w http.ResponseWriter, r *http.Request) {
	// 1. Batasi ukuran file (misal 10MB)
	r.ParseMultipartForm(10 << 20)

	// 2. Ambil file dari form frontend
	file, handler, err := r.FormFile("image")
	if err != nil {
		http.Error(w, "Gagal ambil file", 400)
		return
	}
	defer file.Close()

	// 3. Buat nama file unik (biar gak bentrok)
	// Contoh: 1739283_kucing.jpg
	filename := fmt.Sprintf("%d_%s", time.Now().UnixNano(), handler.Filename)

	// 4. Simpan ke folder "uploads"
	os.MkdirAll("./uploads", os.ModePerm) // Bikin folder kalau belum ada
	dst, err := os.Create("./uploads/" + filename)
	if err != nil {
		http.Error(w, "Gagal simpan file", 500)
		return
	}
	defer dst.Close()

	// Salin isi file
	io.Copy(dst, file)

	// 5. Kirim balik URL gambarnya ke Frontend
	protocol := "http"
	if os.Getenv("PORT") != "" {
		protocol = "https" // Railway otomatis pakai HTTPS
	}

	// r.Host otomatis berisi "localhost:3000" (saat di laptop)
	// atau "gochat-production.up.railway.app" (saat di Railway)
	url := fmt.Sprintf("%s://%s/uploads/%s", protocol, r.Host, filename)

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	json.NewEncoder(w).Encode(map[string]string{"url": url})
}
