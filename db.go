package main

import (
	"log"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

// --- TAMBAHAN BARU: Model User ---
type User struct {
	gorm.Model
	Username string `json:"username" gorm:"unique"` // Username tidak boleh kembar
	Password string `json:"password"`
}

// ---------------------------------

type Message struct {
	gorm.Model
	Username string `json:"username"`
	Content  string `json:"content"`
	Target   string `json:"target"`
	Type     string `json:"type"` // <--- BARU: "text" atau "image"
}

func InitDB() {
	var err error
	DB, err = gorm.Open(sqlite.Open("chat.db"), &gorm.Config{})
	if err != nil {
		log.Fatal("Gagal konek ke database:", err)
	}

	// Migrasi Tabel User dan Message
	DB.AutoMigrate(&User{}, &Message{}) // <--- UPDATE DI SINI
	log.Println("Database Connected & Migrated ✅")
}
