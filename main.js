var app = require('app');
var ipc = require('ipc');
var BrowserWindow = require('browser-window');

// Node modules
var fs = require('fs');
var _ = require('underscore');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var DDPClient = require('ddp');

// App config file
var Config = require('./config.js');

// ===================================
// Bootstrap folders
// ===================================
// Determine directory names.
// Desktop/Todos, Desktop/Todos/Private
var desktopDir = app.getPath('userDesktop');
var appRootDir = desktopDir + '/Todos';
// Create directory
mkdirp(appRootDir);

// ===================================
// Bootstrap Electron
// ===================================
// Report crashes to our server.
require('crash-reporter').start();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
var mainWindow = null;

// Quit when all windows are closed.
app.on('window-all-closed', function() {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform != 'darwin') {
    app.quit();
  }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', function() {
  // Create the browser window.
  mainWindow = new BrowserWindow({width: 800, height: 600});

  // and load the Meteor app
  mainWindow.loadUrl(Config.appUrl);

  // Emitted when the window is closed.
  mainWindow.on('closed', function() {
    mainWindow = null;
  });
});



// ===================================
// DDP handling
// ===================================

// Create DDP Client
var ddpClient = new DDPClient(Config.ddpOptions);

// On Meteor login event
ipc.on('logged-in', function (event, loginToken) {
  // Use token to login with Node DDP client
  connectAndLogin(loginToken, function (error, userInfo) {
    if (error) console.log(error);
    else {
      // Set up observer for Lists + Todos
      setupListsObservers(ddpClient);
      setupTodosObservers(ddpClient);
      // Subscribe to Lists + Todos
      subscribeToPrivateLists();
    }
  });
});

function connectAndLogin(loginToken, cb) {
  // Connect DDP client
  ddpClient.connect(function (error, wasReconnect) {
    if (error) console.log(error);
    // No error - call DDP login method with token
    else ddpClient.call('login', [{resume: loginToken}], cb);
  });
}


// ===================================
// DDP Observers
// ===================================

// Set up observer on DDP events for 'myFiles' collection and act on each event
function setupListsObservers(ddpClient) {
  // Start new observer
  ddpClient.listsObserver = ddpClient.observe('lists');
  // Added
  ddpClient.listsObserver.added = function (id) {
    // Write initial list
    writeList(id);
    // Subscribe to todos for list
    subscribeToTodos(id);
  };
  // Changed
  ddpClient.listsObserver.changed = function (id, oldFields, clearedFields, newFields) {
    // Update list name if changes
    if (newFields.name) {
      // Get old and new path for rename
      var oldPath = getListPath(oldFields.name);
      var newPath = getListPath(newFields.name);
      fs.rename(oldPath, newPath, function (err) {
        if (err) console.log(err);
      });
    }
  };
  // Removed
  ddpClient.listsObserver.removed = function (id, toRemove) {
    // Remove list
    var listPath = getListPath(toRemove.name);
    fs.unlink(listPath, function (err) {
      if (err) console.log(err);
    });
  };
}

// Set up observer on DDP events for 'myFiles' collection and act on each event
function setupTodosObservers(ddpClient) {
  // Start new observer
  ddpClient.todosObserver = ddpClient.observe('todos');
  // Added
  ddpClient.todosObserver.added = function (id) {
    // Get todo doc
    var todoDoc = ddpClient.collections.todos[id];
    // Write list
    writeList(todoDoc.listId);
  };
  // Changed
  ddpClient.todosObserver.changed = function (id, oldFields, clearedFields, newFields) {
    // Rewrite list
    var todoDoc = ddpClient.collections.todos[id];
    writeList(todoDoc.listId);
  };
  // Removed
  ddpClient.todosObserver.removed = function (id, toRemove) {
    // Rewrite list
    writeList(toRemove.listId);
  };
}



// ===================================
// DDP Subscriptions
// ===================================
function subscribeToPrivateLists() {
  // Subscribe to private lists
  ddpClient.subscribe('privateLists', [], function () {
    console.log('private lists subscription complete.');
  });
}

function subscribeToTodos(listId) {
  // Subscribe to todos for a list
  ddpClient.subscribe('todos', [listId], function () {
    console.log('todo subscription to list ' + listId + ' complete.');
  });
}


// ===================================
// File writing
// ===================================
function writeList(listId) {
  // Get doc
  var listDoc = ddpClient.collections.lists[listId];
  // Get all todos for doc
  var todos = ddpClient.collections.todos || [];
  var todoText = '';
  _.each(todos, function (td) {
    if (td.listId === listId) {
      todoText += td.text + '\n';
    }
  });
  // Create file
  fs.writeFile(getListPath(listDoc.name), todoText, function(err) {
    if(err) return console.log(err);
  });
}

// ===================================
// Helpers
// ===================================
function getListPath(listName) {
  return appRootDir + '/' + listName + '.txt';
}

ipc.on('getLocalPath', function (event, args) {
  event.returnValue = getListPath(args.listName);
});
