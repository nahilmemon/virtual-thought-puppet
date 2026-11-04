// Retrieve CSS color variables
const cssVariables = getComputedStyle(document.documentElement);
const bgColor = cssVariables.getPropertyValue("--bg-color").trim();
const textColor = cssVariables.getPropertyValue("--text-color").trim();

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

// To control each thought
let currentlyClickedThought = null;
// To store the distance between the mouse's position and the center of the 
// thought's text content
let distanceBetweenMouseAndThoughtCenterX = 0;
let distanceBetweenMouseAndThoughtCenterY = 0;

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

// function draw() {
//   // Clear the background
//   background("#ffdfdf");

//   // Draw out all the thoughts
//   drawThoughts();
// }

// Mouse click event

function draw() {
  // Clear the background
  background(bgColor);

  // Make sure that if the user clicks and drags a thought around
  // that it can't move outside the bounds of the canvas
  boundMovingThought();

  // Draw out all the thoughts
  drawThoughts();
}


function mousePressed() {
  // Some thoughts might be layered on top of each other. So iterate over the 
  // thoughts array backwards so that we can focus on the top-most thought
  // that was clicked upon
  for (let thoughtIndex = thoughts.length - 1; thoughtIndex >= 0; thoughtIndex--) {
    // Get the properties of the current thought in the thoughts array
    let currentThought = thoughts[thoughtIndex];

    // Calculate the position of the current thought in pixels instead of as 
    // a fraction of the canvas dimensions. Note: this is based on the center 
    // point of the thought's text content
    const currentThoughtXPos = currentThought.x * width;
    const currentThoughtYPos = currentThought.y * height;

    // Calculate the size of the current thought's bounding text box
    textSize(currentThought.fontSize);
    let currentThoughtWidth = textWidth(currentThought.text);
    let currentThoughtHeight = currentThought.fontSize;

    // Calculate the positions of the edges of this bounding box
    let leftEdgeXPos   = currentThoughtXPos - (currentThoughtWidth / 2);
    let rightEdgeXPos  = currentThoughtXPos + (currentThoughtWidth / 2);
    let topEdgeYPos    = currentThoughtYPos - (currentThoughtHeight / 2);
    let bottomEdgeYPos = currentThoughtYPos + (currentThoughtHeight / 2);

    // Check if the mouse cursor is currently positioned within this bounding 
    // box
    if (mouseX > leftEdgeXPos && mouseX < rightEdgeXPos && mouseY > topEdgeYPos && mouseY < bottomEdgeYPos) {
      // Update the currently clicked thought to the current thought
      currentlyClickedThought = currentThought;
      
      // Calculate and remember where the mouse is clicking in relation to 
      // the center of the currently clicked thought
      distanceBetweenMouseAndThoughtCenterX = currentThoughtXPos - mouseX;
      distanceBetweenMouseAndThoughtCenterY = currentThoughtYPos - mouseY;
      
      break;
    }
  }
}

// Make sure that if the user clicks and drags a thought around
// that it can't move outside the bounds of the canvas
function boundMovingThought() {
  // If the user is currently holding onto a thought while dragging the mouse,
  // then double check that they are not trying to drag the thought outside
  // the bounds of the canvas
  if (currentlyClickedThought) {
    // Calculate the new x and y pos of the currently clicked on thought
    let newXPos = mouseX + distanceBetweenMouseAndThoughtCenterX;
    let newYPos = mouseY + distanceBetweenMouseAndThoughtCenterY;

    // Calculate the size of the current thought's bounding text box
    textSize(currentlyClickedThought.fontSize);
    let thoughtWidth = textWidth(currentlyClickedThought.text);
    let thoughtHeight = currentlyClickedThought.fontSize;

    // Constrain the new x and y pos of the currently clicked on thought
    // to within the bounds of the canvas, taking into consideration the 
    // dimensions of the bounding box of this thought
    let newXPosConstrained = constrain(newXPos, thoughtWidth / 2, width - (thoughtWidth / 2));
    let newYPosConstrained = constrain(newYPos, thoughtHeight / 2, height - (thoughtHeight / 2));

    // Update the x and y pos of the currently clicked thought as a fraction
    // of the width and height of the canvas
    currentlyClickedThought.x = newXPosConstrained / width;
    currentlyClickedThought.y = newYPosConstrained / height;

    // Send the updated position of the currently clicked thought to the server so that other clients can see the thought move
    socket.emit("moveThought", {
      id: currentlyClickedThought.id,
      x: currentlyClickedThought.x,
      y: currentlyClickedThought.y
    });
  }
}

// Listen for when the user stops pressing their mouse
function mouseReleased() {
  // When the mouse is released, the user has let go of which thought they
  // are currently clicking on, so update the currently clicked thought 
  // accordingly
  currentlyClickedThought = null;
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
    rotation: 0, // random(-30, 30),

    // Random font size.
    fontSize: random(16, 32),

    // Text color
    color: textColor
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

// Listen to the server for updates on whether another client moved a 
// thought's position
socket.on("thoughtMoved", (incomingThoughtData) => {
  // By using the incoming thought's id, find the matching thought in the 
  // local thoughts array stored on the server
  let thoughtToUpdate = thoughts.find(thought => thought.id === incomingThoughtData.id);
  
  // If the desired thought was found
  if (thoughtToUpdate) {
    // then update its thought with the new position based on the incoming 
    // thought data
    thoughtToUpdate.x = incomingThoughtData.x;
    thoughtToUpdate.y = incomingThoughtData.y;
  }
});

function drawThoughts() {
  // To store if the mouse is currently hovering any thought in particular
  let isMouseHoveringOverAnyThought = false;

  // Draw every thought in the thoughts array
  thoughts.forEach(function (thought) {
    push();

    // Convert fractional positions into canvas coordinates
    const x = thought.x * width;
    const y = thought.y * height;

    // Move and rotate the drawing coordinate system
    translate(x, y);
    // rotate(thought.rotation);

    // Set the thought's appearance
    textSize(thought.fontSize);
    textAlign(CENTER, CENTER);
    fill(thought.color);
    noStroke();

    // Draw the text
    text(thought.text, 0, 0);

    // To determine if the user is hovering over any thought,
    // first get the width and height of the bouding text box for this thought
    let thoughtWidth = textWidth(thought.text);
    let thoughtHeight = thought.fontSize;

    // Then calculate the positions of the edges of this bounding box
    let leftEdgeXPos   = x - (thoughtWidth / 2);
    let rightEdgeXPos  = x + (thoughtWidth / 2);
    let topEdgeYPos    = y - (thoughtHeight / 2);
    let bottomEdgeYPos = y + (thoughtHeight / 2);

    // Finally, check if the mouse cursor is currently positioned within this 
    // bounding box
    if (mouseX > leftEdgeXPos && mouseX < rightEdgeXPos && mouseY > topEdgeYPos && mouseY < bottomEdgeYPos) {
      isMouseHoveringOverAnyThought = true;
    }

    pop();
  });

  // If any the mouse is indeed hovering over or clicking any thought 
  // then show the hand icon, otherwise, show the arrow icon for the mouse
  if (isMouseHoveringOverAnyThought || currentlyClickedThought) {
    cursor(HAND);
  } else {
    cursor(ARROW);
  }
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