// Thought Form
let thoughtForm = document.querySelector("#thoughtForm");
let thoughtInput = document.querySelector("#thoughtInput");
// Socket
let socket = io();
// To store all the thoughts received from the server
let thoughts = [];


function setup() {
  console.log("Client js has loaded");
  createCanvas(windowWidth, windowHeight);
  background("#ffdfdf");
  angleMode(DEGREES);
  textFont("Kalam");
}

function draw() {
  // Clear the background
  background("#ffdfdf");
  // Draw out all the thoughts
  drawThoughts();
}

// Log connection on the client side
socket.on('connect', () => {
  console.log('Connected');
});

// Listen for form submission
thoughtForm.addEventListener("submit", (event) => {
  event.preventDefault();
  // Retrieve text from thought input text field
  let currentThought = thoughtInput.value;
  console.log(currentThought);

  // Clear thought input text field
  thoughtInput.value = "";

  // Create properly formatted thought object to send to server
  let thoughtObject = {
    text: currentThought,
    username: "anonymous user",

    // Random positions (since every client might have different window
    // widths and heights, store these as a fraction instead)
    x: random(0.1, 0.9),
    y: random(0.15, 0.8),

    // Random rotation in degrees
    rotation: random(-30, 30),

    // Random font size.
    fontSize: random(16, 32),

    // White paper.
    color: "#000000"
  };

  //1. Send thought data to server
  socket.emit("newThought", thoughtObject);
});

// 4. Listening for data from the server - on getting "newThought" --> log message
socket.on("newThought", (incomingData) => {
  console.log(incomingData);
  // Save new thought inside local thoughts array
  thoughts.push(incomingData);
});

function drawThoughts() {
  // Draw every thought in our array.
  thoughts.forEach(function (thought) {
    push();

    // Convert fractional positions into canvas coordinates
    const x = thought.x * width;
    const y = thought.y * height;

    // Move and rotate the drawing coordinate system
    translate(x, y);
    rotate(thought.rotation);

    // Set the thought's appearance
    textSize(thought.fontSize);
    textAlign(CENTER, CENTER);
    fill(thought.color);
    noStroke();

    // Draw the text
    text(thought.text, 0, 0);

    pop();
  });
}