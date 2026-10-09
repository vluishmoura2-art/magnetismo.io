const { World } = require("./physics");

const MAX_PLAYERS = 4;

class Room {
  constructor(id) {
    this.id = id;
    this.players = new Map();
    this.world = new World();
  }

  get size() {
    return this.players.size;
  }

  isFull(maxPlayers = MAX_PLAYERS) {
    return this.players.size >= maxPlayers;
  }

  add(player) {
    this.players.set(player.id, player);
  }

  remove(playerId) {
    this.players.delete(playerId);
  }
}

class RoomManager {
  constructor(maxPlayers = MAX_PLAYERS) {
    this.maxPlayers = maxPlayers;
    this.rooms = new Map();
    this.nextRoomId = 1;
  }

  createRoom() {
    const id = this.nextRoomId++;
    const room = new Room(id);
    this.rooms.set(id, room);
    return room;
  }

  findOpenRoom() {
    for (const room of this.rooms.values()) {
      if (!room.isFull(this.maxPlayers)) return room;
    }
    return null;
  }

  join(player) {
    let room = this.findOpenRoom();
    let created = false;
    if (!room) {
      room = this.createRoom();
      created = true;
    }
    room.add(player);
    player.roomId = room.id;
    return { room, created };
  }

  leave(player) {
    const room = this.rooms.get(player.roomId);
    if (!room) return null;
    room.remove(player.id);
    if (room.size === 0) {
      this.rooms.delete(room.id);
    }
    return room;
  }

  activeRooms() {
    return Array.from(this.rooms.values());
  }
}

module.exports = { Room, RoomManager, MAX_PLAYERS };
