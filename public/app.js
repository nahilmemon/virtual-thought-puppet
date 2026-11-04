// Retrieve document elements
const theaterRow = document.querySelector("#theaterRow");
const toggleChatButton = document.querySelector("#toggleChatButton");
const chatSidebar = document.querySelector("#audienceChatSidebar");

// Thought Form
const thoughtForm = document.querySelector("#thoughtForm");
const thoughtInput = document.querySelector("#thoughtInput");
// Socket
let socket = io();
// To store all the thoughts received from the server
let thoughts = [];

// Stage Deck
const stageDeckSection = document.querySelector("#stageDeckSection");
let stageDeckWidth;
let stageDeckHeight;
// Create an observer to liste for changes to the dimensions 
// of the stageDeckSections
const stageDeckObserver = new ResizeObserver(() => {
  calculateStageDeckDimensions();
  resizeCanvas(stageDeckWidth, stageDeckHeight);
});

// === Initialization Code === //
// Initialize the aria-properties for the toggleChatButton based on initial
// screen size
initializeToggleChatButtonAriaAttributes();


function setup() {
  console.log("Client js has loaded");
  
  let puppetStageDeckCanvas = createCanvas(100, 100);
  puppetStageDeckCanvas.parent("stageDeckSection");

  // Wait until the browser has completed its initial layout
  requestAnimationFrame(() => {
    calculateStageDeckDimensions();
    resizeCanvas(stageDeckWidth, stageDeckHeight);

    // Start listening for changes in the dimensions of the stageDeckSection
    stageDeckObserver.observe(stageDeckSection);
  });

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

// Get dimensions of the stageDeckSection
function calculateStageDeckDimensions() {
  stageDeckWidth = stageDeckSection.offsetWidth;
  stageDeckHeight = stageDeckSection.offsetHeight;
}

// Log connection on the client side
socket.on('connect', () => {
  console.log('Connected');
});

// Listen for form submission
thoughtForm.addEventListener("submit", (event) => {
  event.preventDefault();
  // Retrieve text from thought input text field
  let currentThought = thoughtInput.value.trim();
  console.log(currentThought);

  // If the thought text input is empty, then abort mission immediately
  if (!currentThought) {
    return;
  }

  // Clear thought input text field
  thoughtInput.value = "";

  // Create properly formatted thought object to send to server
  let thoughtObject = {
    // Create a unique id for the thought object
    id: crypto.randomUUID(),

    // Text content
    text: currentThought,

    // Author of the thought
    username: "anonymous user",    

    // Random positions (since every client might have different window
    // widths and heights, store these as a fraction instead)
    x: random(0.1, 0.9),
    y: random(0.15, 0.8),

    // Random rotation in degrees
    rotation: random(-30, 30),

    // Random font size.
    fontSize: random(16, 32),

    // Text color
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

// For the toggleChatButton in the nav, change the aria-label and 
// aria-expanded properties based on whether chat sidebar is open or closed
function updateToggleChatButtonAriaAttributes(isChatSidebarOpen) {
  // Update the aria-expanded property according to the chat sidebar's 
  // current display state
  toggleChatButton.setAttribute("aria-expanded", isChatSidebarOpen);

  // Determine new aria-label text according to the chat sidebar's 
  // current display state
  let newAriaLabel;
  if (isChatSidebarOpen) {
    newAriaLabel = "Hide chat";
  } else {
    newAriaLabel = "Show chat";
  }

  // Update the aria-label property according to the chat sidebar's 
  // current display state
  toggleChatButton.setAttribute("aria-label", newAriaLabel);
}

// Initialize the aria-properties for the toggleChatButton based on initial
// screen size
function initializeToggleChatButtonAriaAttributes() {
  if (window.innerWidth >= 768) {
    updateToggleChatButtonAriaAttributes(true);
  } else {
    updateToggleChatButtonAriaAttributes(false);
  }
}
// Update the aria-properties of the toggleChatButton based on both the 
// display state of the chat bar and the new window size
function updateChatUponWindowResize(){
  // If we're on desktop devices
  if (window.innerWidth >= 768) {
    // Determine whether the chat sidebar is currently showing or not
    let chatSidebarDisplayState;
    if (theaterRow.classList.contains("chat-hidden")) {
      chatSidebarDisplayState = false;
    } else {
      chatSidebarDisplayState = true;
    }

    // Update the aria-properties for the toggleChatButton according to 
    // the chat sidebar's current display state
    updateToggleChatButtonAriaAttributes(chatSidebarDisplayState);
  }
  // Else if we're on mobile devices
  else {
    // Then use Bootstrap's built-in offcanvas method
    let chatOffcanvas = bootstrap.Offcanvas.getOrCreateInstance(chatSidebar);
    chatOffcanvas.hide();
    updateToggleChatButtonAriaAttributes(false);
  }
}

// When the user clicks on the toggleChatButton, show/hide the chat sidebar
// and update the aria-properties of this button accordingly
toggleChatButton.addEventListener("click", (event) => {
  // If we're on desktop devices
  if (window.innerWidth >= 768) {
    // Add/remove the chat-hidden on theaterRow, which hides/shows the chat
    // sidebar
    theaterRow.classList.toggle("chat-hidden");

    // Determine whether the chat sidebar is currently showing or not
    let chatSidebarDisplayState;
    if (theaterRow.classList.contains("chat-hidden")) {
      chatSidebarDisplayState = false;
    } else {
      chatSidebarDisplayState = true;
    }

    // Update the aria-label properties for the toggleChatButton according to 
    // the chat sidebar's current display state
    updateToggleChatButtonAriaAttributes(chatSidebarDisplayState);
  }
  // Else if we're on mobile devices
  else {
    // Then use Bootstrap's built-in offcanvas method
    let chatOffcanvas = bootstrap.Offcanvas.getOrCreateInstance(chatSidebar);
    chatOffcanvas.toggle();
  }
});

// If, on mobile, the user ever clicks the show/hide chat buttons
// then update the aria-properties of the toggleChatButton in the nav
// Showing the chat sidebar
chatSidebar.addEventListener("shown.bs.offcanvas", () => {
  updateToggleChatButtonAriaAttributes(true);
});
// Hiding the chat sidebar
chatSidebar.addEventListener("hidden.bs.offcanvas", () => {
  updateToggleChatButtonAriaAttributes(false);
});

// Event listenerg for when the size of the window changes
window.addEventListener("resize", () => {
  // Update the aria-properties of the toggleChatButton based on both the 
  // display state of the chat bar and the new window size
  updateChatUponWindowResize();
});