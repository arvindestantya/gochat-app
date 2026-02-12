package main

import (
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

const (
	// Waktu tunggu untuk menulis pesan ke peer (browser)
	writeWait = 10 * time.Second

	// Waktu tunggu maksimal menerima pong dari peer
	pongWait = 60 * time.Second

	// Kirim ping ke peer secara berkala agar koneksi tidak putus
	pingPeriod = (pongWait * 9) / 10

	// Ukuran maksimal pesan
	maxMessageSize = 512
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// Bolehkan koneksi dari React (localhost:5173) nanti
	CheckOrigin: func(r *http.Request) bool { return true },
}

// Client adalah perantara antara WebSocket dan Hub
type Client struct {
	hub *Hub

	// Koneksi WebSocket
	conn *websocket.Conn

	// Channel buffer untuk pesan outbound (keluar)
	send     chan []byte
	Username string // <--- TAMBAHAN: Identitas User
}

// readPump: Membaca pesan DARI Browser -> KE Hub
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()
	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error { c.conn.SetReadDeadline(time.Now().Add(pongWait)); return nil })

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			break
		}
		// Kirim pesan ke Hub untuk disebar
		c.hub.broadcast <- message
	}
}

// writePump: Membaca pesan DARI Hub -> KE Browser
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// Hub menutup channel
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Tambahkan pesan antrian lainnya ke pesan websocket ini (optimasi)
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			// Kirim Ping agar koneksi tetap hidup (Keep-Alive)
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// serveWs menangani permintaan HTTP yang mau upgrade ke WebSocket
func serveWs(hub *Hub, w http.ResponseWriter, r *http.Request) {
	// Ambil ?username=Budi dari URL
	username := r.URL.Query().Get("username")
	if username == "" {
		http.Error(w, "Username required", 400)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}

	// Masukkan Username ke struct Client
	client := &Client{hub: hub, conn: conn, send: make(chan []byte, 256), Username: username}
	client.hub.register <- client

	go client.writePump()
	go client.readPump()
}
