// === Global Variables === //
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

// Stores all the thoughts received from the server
let thoughts = [];

// Store the connections between the thoughts
let connections = [];
// Currenly selected thoughts
let firstSelectedThought = null;
let secondSelectedThought = null;

// Keeps track of which thought is currently being dragged around
let currentlyClickedThought = null;
// Distance between the mouse's position and the center of the 
// thought's text content
let distanceBetweenMouseAndThoughtCenterX = 0;
let distanceBetweenMouseAndThoughtCenterY = 0;

// Stage Deck
const stageDeckSection = document.querySelector("#stageDeckSection");
let stageDeckWidth;
let stageDeckHeight;

// === Initialization Code === //
// Initialize the aria-properties for the toggleChatButton based on initial
// screen size
initializeToggleChatButtonAriaAttributes();

// Create an observer to listen for changes to the dimensions of the 
// stageDeckSection
const stageDeckObserver = new ResizeObserver(() => {
  // Recalculate the stageDeckSection dimensions and resize the canvas 
  // accordingly
  calculateStageDeckDimensions();
  resizeCanvas(stageDeckWidth, stageDeckHeight);
});

// === Setup === //
function setup() {
  console.log("Client js has loaded");
  
  // Create canvas and attach it the right html section
  let puppetStageDeckCanvas = createCanvas(100, 100);
  puppetStageDeckCanvas.parent("stageDeckSection");

  // Wait until the browser has completed its initial layout
  requestAnimationFrame(() => {
    // Recalculate the stageDeckSection dimensions and resize the canvas 
    // accordingly
    calculateStageDeckDimensions();
    resizeCanvas(stageDeckWidth, stageDeckHeight);

    // Start listening for changes in the dimensions of the stageDeckSection
    stageDeckObserver.observe(stageDeckSection);
  });

  // Change which units rotation angles are measured in
  angleMode(DEGREES);
  // Change the font family for text renderings
  textFont("Kalam");
}

// === Draw === //
function draw() {
  // Clear the background
  background(bgColor);

  // Make sure that if the user clicks and drags a thought around that it 
  // can't move outside the bounds of the canvas
  boundMovingThought();

  // Draw all the lines connecting the thoughts together
  drawThoughtConnections();

  // Draw all the thoughts
  drawThoughts();
}

// === Mouse Events === //
// Listen for while the user is pressing the left mouse button
function mousePressed() {
  // Store the thought that was clicked on (default to null if empty canvas was 
  // clicked)
  let clickedThought = null;

  // Iterate through all the thoughts to find which thought was clicked on
  // Note: some thoughts might be rendered on top of each other, so iterate
  // through the array backwards, to find the most recent, top-most thought
  // that was clicked upon
  for (let thoughtIndex = thoughts.length - 1; thoughtIndex >= 0; thoughtIndex--) {
    // Get the properties of the current thought in the thoughts array
    let currentThought = thoughts[thoughtIndex];

    // Calculate the position of the current thought in pixels instead of as 
    // a fraction of the canvas dimensions. Note: this is based on the 
    // center point of the thought's text content
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

    // Check if the mouse cursor is currently positioned within this 
    // bounding box
    if (mouseX > leftEdgeXPos && mouseX < rightEdgeXPos && mouseY > topEdgeYPos && mouseY < bottomEdgeYPos) {
      // Remember this thought as the one that was clicked on
      clickedThought = currentThought;

      // Stop iterating the thoughts array since the selected top-most 
      // thought has been found
      break;
    }
  }

  // If a thought was found, i.e. the user didn't just click a blank space on 
  // the canvas
  if (clickedThought !== null) {
    // === SHIFT + Left Click ===== //
    // If the user is also pressing the SHIFT key while left clicking the mouse
    if (event.shiftKey) {
      console.log("Shift click detected!");
      // If a thought hasn't previously been selected to add/remove a 
      // connection
      if (firstSelectedThought === null) {
        // Then update the first selected thought with the thought that was 
        // just clicked on
        firstSelectedThought = clickedThought;
        console.log("First thought selected!");
      }
      // Otherwise, double-check that the user isn't reselecting the same 
      // thought as before
      else if (firstSelectedThought.id === clickedThought.id) {
        // In which case, deselect the thought
        firstSelectedThought = null;
        console.log("Thought deselected!");
      }
      // Otherwise, the user has just clicked the second thought. So now we 
      // need to determine whether to add/remove a connection based on 
      // whether a connection already exists
      else {
        // Check if a connection already exists between these two thoughts
        let existingConnectionIndex = connections.findIndex(connection =>
          (connection.firstId === firstSelectedThought.id &&
          connection.secondId === clickedThought.id) ||

          (connection.firstId === clickedThought.id &&
          connection.secondId === firstSelectedThought.id)
        );

        // If the connection already exists between these thoughts, delete it
        if (existingConnectionIndex !== -1) {
          // Remember which connection is being removed
          const removedConnection = connections[existingConnectionIndex];
          // Remove the existing connection from the local connections array
          connections.splice(existingConnectionIndex, 1);
          console.log("Connection deleted!");

          // Tell the server to broadcast this removal to other clients
          socket.emit("removeConnection", removedConnection);
        } 
        // Otherwise, add a new connection between these two thoughts
        else {
          // Create a new connection
          const newConnection = {
            firstId: firstSelectedThought.id,
            secondId: clickedThought.id
          };
          // Add the new connection to the local connections array
          connections.push(newConnection);
          console.log("Connection created!");

          // Tell the server to broadcast this addition to other clients
          socket.emit("addConnection", newConnection);
        }
        
        // Reset which thoughts have been selected
        firstSelectedThought = null;
      }
    }
    // === Left Click Only === //
    // Otherwise, if the user clicked on a thought without holding SHIFT
    else {
      // Update the currently clicked thought to the thought that was clicked on
      currentlyClickedThought = clickedThought;

      // Calculate the position of the clicked thought in pixels
      const clickedThoughtXPos = clickedThought.x * width;
      const clickedThoughtYPos = clickedThought.y * height;

      // Calculate and remember where the mouse is clicking in relation to 
      // the center of the currently clicked thought
      distanceBetweenMouseAndThoughtCenterX = clickedThoughtXPos - mouseX;
      distanceBetweenMouseAndThoughtCenterY = clickedThoughtYPos - mouseY;
    }
  }

  // Prevent the browser from performing default browser behaviour when 
  // shift-clicking anywhere on the blank canvas, such as highlighting text
  if (event.shiftKey) {
    return false;
  }
}

// Listen for when the user stops pressing their mouse
function mouseReleased() {
  // When the mouse is released, the user has let go of which thought they are 
  // currently clicking on, so update the currently clicked thought accordingly
  currentlyClickedThought = null;
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

// === Socket Events === //
// Log connection on the client side
socket.on('connect', () => {
  console.log('Connected');
});

// Listen to the server for new thoughts
socket.on("newThought", (incomingData) => {
  console.log(incomingData);
  // Connect this new thought to the previous thought if there is a previous
  // thought
  if (thoughts.length > 0) {
    let previousThought = thoughts[thoughts.length - 1];
    connections.push({
      firstId: previousThought.id,
      secondId: incomingData.id
    });
  }

  // Save the new thought inside the local thoughts array
  thoughts.push(incomingData);
});

// Listen to the server for updates on whether another client moved a 
// thought's position
socket.on("thoughtMoved", (incomingThoughtData) => {
  // By using the incoming thought's id, find the matching thought in the 
  // local thoughts array
  let thoughtToUpdate = thoughts.find(thought => thought.id === incomingThoughtData.id);
  
  // If the desired thought was found
  if (thoughtToUpdate) {
    // Then update its thought with the new position based on the incoming 
    // thought data
    thoughtToUpdate.x = incomingThoughtData.x;
    thoughtToUpdate.y = incomingThoughtData.y;
  }
});

// Listen to the server for updates on whether another client removed a connection
socket.on("connectionRemoved", (incomingConnectionItem) => {
  // Find this connection in the local connections array
  let existingConnectionIndex = connections.findIndex(currentConnectionItem =>
    (currentConnectionItem.firstId === incomingConnectionItem.firstId &&
    currentConnectionItem.secondId === incomingConnectionItem.secondId) ||

    (currentConnectionItem.firstId === incomingConnectionItem.secondId &&
    currentConnectionItem.secondId === incomingConnectionItem.firstId)
  );

  // If the connection already exists
  if (existingConnectionIndex !== -1) {
    // Then remove the existing connection
    connections.splice(existingConnectionIndex, 1);
    console.log("Incoming connection deleted!");
  }
});

// Listen to the server for updates on whether another client added a connection
socket.on("connectionAdded", (incomingConnectionItem) => {
  // Double-check that this connection doesn't already exist in the local connections array
  let existingConnectionIndex = connections.findIndex(currentConnectionItem =>
    (currentConnectionItem.firstId === incomingConnectionItem.firstId &&
    currentConnectionItem.secondId === incomingConnectionItem.secondId) ||

    (currentConnectionItem.firstId === incomingConnectionItem.secondId &&
    currentConnectionItem.secondId === incomingConnectionItem.firstId)
  );

  // If the connection doesn't already exist
  if (existingConnectionIndex === -1) {
    // Then add the incoming connection
    connections.push(incomingConnectionItem);
    console.log("Incoming connection added!");
  }
});

// === Draw the Puppet === //
// Draw all the connections onto the canvas
function drawThoughtConnections() {
  // Set the connection's appearance
  stroke(textColor);
  strokeWeight(1.5);

  // Draw every connection in the connections array
  for (let connection of connections) {
    // Find the first thought
    let firstThought = thoughts.find(
      thought => thought.id === connection.firstId
    );
    // Find the second thought
    let secondThought = thoughts.find(
      thought => thought.id === connection.secondId
    );

    // If both thoughts at each end of the connection are found
    if (firstThought && secondThought) {
      // Draw a line from the first to the second thought, converting from the
      // fractional to absolute coordinates on the canvas
      line(
        firstThought.x * width,
        firstThought.y * height,
        secondThought.x * width,
        secondThought.y * height
      );
    }
  }
}

// Draw all the thoughts onto the canvas
function drawThoughts() {
  // To store if the mouse is currently hovering over any thought in particular
  let isMouseHoveringOverAnyThought = false;

  // Draw every thought in the thoughts array
  thoughts.forEach(function (thought) {
    push();

    // Convert fractional positions into absolute canvas coordinates
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
    // first get the width and height of the bounding text box for this thought
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

  // If the mouse is indeed hovering over or clicking any thought, 
  // then show the hand icon, otherwise, show the arrow icon for the mouse
  if (isMouseHoveringOverAnyThought || currentlyClickedThought) {
    cursor(HAND);
  } else {
    cursor(ARROW);
  }
}

// === Stage Deck Section === //
// Get dimensions of the stageDeckSection
function calculateStageDeckDimensions() {
  stageDeckWidth = stageDeckSection.offsetWidth;
  stageDeckHeight = stageDeckSection.offsetHeight;
}

// === Chat Sidebar === //
// Initialize the aria-properties for the toggleChatButton based on initial
// screen size
function initializeToggleChatButtonAriaAttributes() {
  // Consider the chat sidebar as open on larger screen sizes
  if (window.innerWidth >= 768) {
    updateToggleChatButtonAriaAttributes(true);
  } 
  // Consider the chat sidebar as closed on smaller screen sizes
  else {
    updateToggleChatButtonAriaAttributes(false);
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

// === Event Listeners === //
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

// Event listener for when the size of the window changes
window.addEventListener("resize", () => {
  // Update the aria-properties of the toggleChatButton based on both the 
  // display state of the chat bar and the new window size
  updateChatUponWindowResize();
});

// If the user right-clicks on the p5 canvas, prevent the context menu from 
// popping up
stageDeckSection.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

// Listen for thought form submission
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

    // Author of the thought (anonymous for now)
    username: "anonymous user",

    // Random positions (since every client might have different window
    // widths and heights, store these as a fraction instead)
    x: random(0.1, 0.9),
    y: random(0.15, 0.8),

    // Rotation in degrees (0 for now, previously random)
    rotation: 0, // random(-30, 30),

    // Random font size.
    fontSize: random(16, 32),

    // Text color
    color: textColor
  };

  // Send the newly entered thought data to the server
  socket.emit("newThought", thoughtObject);
});