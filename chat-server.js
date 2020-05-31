// Require the packages we will use:
let http = require("http"),
socketio = require("socket.io"),
fs = require("fs");

// Listen for HTTP connections.  This is essentially a miniature static file server that only serves our one file, client.html:
let app = http.createServer(function(req, resp){
    // This callback runs when a new connection is made to our HTTP server.

    fs.readFile("client.html", function(err, data){
        // This callback runs when the client.html file has been read from the filesystem.

        if(err) return resp.writeHead(500);
        resp.writeHead(200);
        resp.end(data);
    });
});
app.listen(3456);

 // some of the functionality below is taken from https://github.com/NikkiWines/WUSTL-ProjectsRepository/blob/master/CSE330S-RapidPrototypeDev/Module6-Group/chat-server.js
//create a user object
class user {
    constructor(username, room) {
        this.username = username;
        this.room = room;
    }
}
let userinfo = [new user()];
let rooms =['Lobby', 'Room1', 'Room2'];
let passwords = ['', '', '']; 
let roomCreator = ['', '', ''];
let bannedUsers = [[''],[''],['']];
let socketID = {};

// Do the Socket.IO magic:
let io = socketio.listen(app);
io.sockets.on("connection", function(socket){
    // sockets.push(socket);

    io.sockets.emit("updateRoom", {rooms:rooms});

    socket.on("new-user", data=>{
        
        let username = data.username; 

        socketID[username] = socket.id;

        let room= data.defaultRoom; 
        
        // by default a users joins the lobby
        socket.join(room); 

        //push new user information into the array
        userinfo.push(new user(username, room));

        io.sockets.to(room).emit("activeUsers", {userinfo:userinfo, room:room}); 
    
        // displays message to users in the chat room that a user has joined
        io.sockets.to(room).emit("user-connected", {username:username,room:room});

		socket.on('message_to_server', function(data) {
			// This callback runs when the server receives a new message from the client.
			io.sockets.to(room).emit("message_to_client",{username:username, message:data.message, isBold:data.isBold, isItalics:data.isItalics}); 
		});

        
		socket.on('emoji', function(data) {
            // This callback runs when the server receives a new message from the client.
            io.sockets.to(room).emit("displayEmoji", {username:username,isgrinning:data.isgrinning,iskissing:data.iskissing, iswinking:data.iswinking,istounge:data.istounge});
        });
        
        // displays message to users in the chat room that a user has left
        socket.on('disconnect', function(){ 
            io.sockets.to(room).emit("user-disconnected", {username:username,room:room});
        });

        // add data for the new room
        socket.on("newRoom", function(data) {
            rooms.push(data.roomName); 
            passwords.push(data.password);
            roomCreator.push(username);
            bannedUsers.push(['']);
            console.log(rooms);
            console.log(passwords);
            io.sockets.emit("updateRoom", {rooms:rooms}); 
        });


    socket.on("changeRoom", function(data) {
        for (i = 0; i< rooms.length; i ++) {
            //check if room data is valid to join
            if ((rooms[i] == data.room) && (passwords[i] == data.password)) { 
                canJoinRoom = true;
				for (k=0; k < bannedUsers[i].length; k++) {
					if (username == bannedUsers[i][k]) {
						canJoinRoom = false;
						io.sockets.to(username).emit("bannedFromJoining-room",{username:username});
					}
                }
                if(canJoinRoom) {
					socket.leave(room);
                    io.sockets.to(room).emit("disconnected-room", {username:username, room:room, userinfo:userinfo});
                    for (i=0; i < userinfo.length; i ++){ 
                        if (userinfo[i].username == username) { 
                            userinfo[i].room = undefined;
                        }
                    }
                    
                    room = data.room;
                    socket.join(room);

                    io.sockets.to(room).emit("connected-room", {username:username, room:room, userinfo:userinfo});

                    for (i=0; i < userinfo.length; i ++){ 
                        if (userinfo[i].username == username) {
                            userinfo[i].room = room;
                        }
                    }
                    io.sockets.to(room).emit("activeUsers", {userinfo:userinfo, room:room}); 
				} 
				else{
					io.sockets.to(username).emit("bannedFromJoining-room",{username:username});
				}
			} 
        }
    });

    socket.on("kickUser", function(data) {
        for (i=0; i < roomCreator.length; i ++){ 
            if (roomCreator[i] == username) {
                let userKicked = data.kickusername;

                io.sockets.to(socketID[data.kickusername]).emit("kickedout-room",{username:userKicked,room:room});
                
                io.sockets.to(room).emit("activeUsers", userinfo, room); 
            }
        }
    });
    
//force the kicked out user to leave room
     socket.on("leaveRoom", function(){
        socket.leave(room);
        for (i=0; i < userinfo.length; i ++){ 
            if (userinfo[i].username == username) { 
                userinfo[i].room = undefined;
            }
        }
        
        let joinLobby = "Lobby";
       
        for (i=0; i < userinfo.length; i ++){ 
            if (userinfo[i].username == username) {
                userinfo[i].room = joinLobby;
            }
        }
        socket.join("Lobby");
    });

	
	socket.on("banUser", function(data) {
		for (i=0; i < roomCreator.length; i ++){ 
			if (roomCreator[i] == username) {
				var userBanned = data['banusername'];
				var chatRoom = data['chatroom'];
				io.sockets.to(room).emit("banned-room",{username: userBanned});
				chatRoom = rooms[0];
				for (j=0; j < rooms.length; j++) {
					if (rooms[j] == room) {
						bannedUsers[j].push(userBanned);
					}
				}
				for (i=0; i < userinfo.length; i ++){ 
					if (userinfo[i].username == userBanned) {
						userinfo[i].room = chatRoom;
					}
				}
				io.sockets.to(room).emit("activeUsers", userinfo, room); 
			}
			else{
				io.sockets.to(room).emit("Only the room creator can ban users from joining.");
			}
		}
	});

    socket.on('pm', function(data) {
		io.sockets.to(socketID[data.receiver]).emit("privateMessage",{from:username, message:data.pmtext})
    });

});

});

