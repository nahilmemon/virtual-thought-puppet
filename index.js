// Import modules
import express from "express";
import {Server} from "socket.io";
import {createServer} from "node:http";

// Set up the server
// Ensuring that our server supports express 
const app = express();
const server = createServer(app); // http server which now supports express
const io = new Server(server); // make the http server support sockets

const PORT = process.env.PORT || 3000; // useful to add when you deploy

// Serves the public folder
app.use("/", express.static("public"));

server.listen(PORT, ()=> {
  console.log(`** Running at localhost: ${PORT}`);
});

// Handle devices connecting to socket
io.on("connection", (socket) => {
  console.log(`A new client has connected at ID: ${socket.id}`);

  // 2. Listen for a new thought
  socket.on("newThought", (incomingData)=> {
    console.log(incomingData);

    // 3. share the new thought to everyone else
    io.emit("newThought", incomingData);
    // Note: could do broadcast instead (sends it to everyone except the client who first sent this piece of data)
  });

  // Listens for the client to disconnect
  socket.on("disconnect", () => {
    console.log(`A client disconnected at ID: ${socket.id}`);
  });
});