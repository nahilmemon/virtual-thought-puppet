// Import modules
import express from "express";
import {Server} from "socket.io";
import {createServer} from "node:http";

// === Server Setup === //
// Create an Express app
const app = express();
// Wrap this Express app in an HTTP server
const server = createServer(app);
// Make sure the HTTP server also supports Socket.io
const io = new Server(server);

// Setup port so that it tries the environment's port first during deployment
// Otherwise default to localhost:3000
const PORT = process.env.PORT || 3000;

// Serve static front-end files from the public folder
app.use("/", express.static("public"));

// Start the server, listening in at desired port for incoming connections
server.listen(PORT, ()=> {
  console.log(`** Running at localhost: ${PORT}`);
});

// === Socket Events === //
// Handle devices connecting to socket
io.on("connection", (socket) => {
  console.log(`A new client has connected at ID: ${socket.id}`);

  // Listen for when a client creates a new thought
  socket.on("newThought", (incomingThoughtData)=> {
    console.log(incomingThoughtData);
    // Then broadcast this new thought to every client, including the original 
    // sender
    io.emit("newThought", incomingThoughtData);
  });

  // Listen for when a client has moved a thought's position
  socket.on("moveThought", (incomingThoughtData) => {
    // Then broadcast this thought and its new position to all the other 
    // clients except the sender
    socket.broadcast.emit("thoughtMoved", incomingThoughtData);
  });

  // Listen for when a client has removed a connection
  socket.on("removeConnection", (incomingConnectionData) => {
    // Then broadcast this removed connection object to all the other 
    // clients except the sender
    socket.broadcast.emit("connectionRemoved", incomingConnectionData);
  });

  // Listen for when a client has added a connection between two thoughts
  socket.on("addConnection", (incomingConnectionData) => {
    // Then broadcast this added connection object to all the other 
    // clients except the sender
    socket.broadcast.emit("connectionAdded", incomingConnectionData);
  });

  // Listen for when a client disconnects from the server
  socket.on("disconnect", () => {
    console.log(`A client disconnected at ID: ${socket.id}`);
  });
});