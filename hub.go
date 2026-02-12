package main

import (
	"encoding/json"
	"log"
)

// Struct untuk daftar user online
type UserListEvent struct {
	Type string   `json:"type"`
	List []string `json:"list"`
}

type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
}

func newHub() *Hub {
	return &Hub{
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    make(map[*Client]bool),
	}
}

// Fungsi untuk update daftar user ke semua orang
func (h *Hub) broadcastUserList() {
	var users []string
	for client := range h.clients {
		users = append(users, client.Username)
	}

	event := UserListEvent{
		Type: "users",
		List: users,
	}
	data, _ := json.Marshal(event)

	for client := range h.clients {
		client.send <- data
	}
}

func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
			h.broadcastUserList() // Kirim update saat ada yg masuk

		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
				h.broadcastUserList() // Kirim update saat ada yg keluar
			}

		case message := <-h.broadcast:
			// 1. Uraikan JSON
			var msgObj Message
			err := json.Unmarshal(message, &msgObj)
			if err != nil {
				log.Println("Error unmarshal:", err)
				continue
			}

			// --- [BAGIAN PENTING: TANGANI REQUEST LIST USER] ---
			// Jika tipe pesannya "get_users", kirim daftar user & JANGAN simpan ke DB
			if msgObj.Type == "get_users" {
				h.broadcastUserList()
				continue
			}
			// ---------------------------------------------------

			// 2. Simpan ke Database (Hanya pesan chat biasa/gambar)
			if msgObj.Content != "" {
				DB.Create(&msgObj)
			}

			// 3. LOGIKA ROUTING (Japri vs Broadcast)
			if msgObj.Target != "" {
				// MODE JAPRI
				for client := range h.clients {
					if client.Username == msgObj.Target || client.Username == msgObj.Username {
						select {
						case client.send <- message:
						default:
							close(client.send)
							delete(h.clients, client)
						}
					}
				}
			} else {
				// MODE BROADCAST
				for client := range h.clients {
					select {
					case client.send <- message:
					default:
						close(client.send)
						delete(h.clients, client)
					}
				}
			}
		}
	}
}
