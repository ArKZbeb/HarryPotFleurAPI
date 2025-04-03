var SerialPort = require("serialport");
var xbee_api = require("xbee-api");
const mqtt = require("mqtt");
const client = mqtt.connect("mqtt://test.mosquitto.org");
var C = xbee_api.constants;
require("dotenv").config();

if (!process.env.SERIAL_PORT)
  throw new Error("Missing SERIAL_PORT environment variable");

if (!process.env.SERIAL_BAUDRATE)
  throw new Error("Missing SERIAL_BAUDRATE environment variable");
// if (!process.env.DESTINATION_ADRESS)
// throw new Error('Missing DESTINATION_ADRESS environment variable');
let test = false;
client.on("connect", () => {
  client.subscribe("plante/valve", (err) => {});
  client.subscribe("plante/eau", (err) => {
    if (err) {
      console.error("Erreur lors de la souscription à plante/eau", err);
    } else {
      console.log("Souscription réussie à plante/eau");
    }
  });
});
client.on("message", (topic, message) => {
  if (topic === "plante/eau") {
    console.log("Message reçu sur plante/eau :", message.toString());

    if (message.toString() === "true") {
      console.log("Ouverture de la valve demandée.");
      test = true;
    }
    if (message.toString() === "false") {
      console.log("fermeture de la valve demandée.");
      test = true;
    }
  }
});

const SERIAL_PORT = process.env.SERIAL_PORT;
// const DESTINATION_ADRESS = process.env.DESTINATION_ADRESS;

var xbeeAPI = new xbee_api.XBeeAPI({
  api_mode: 2,
});

let serialport = new SerialPort(
  SERIAL_PORT,
  {
    baudRate: parseInt(process.env.SERIAL_BAUDRATE) || 9600,
  },
  function (err) {
    if (err) {
      return console.log("Creating SerialPort", err.message);
    }
  }
);

serialport.pipe(xbeeAPI.parser);
xbeeAPI.builder.pipe(serialport);

const BROADCAST_ADDRESS = "FFFFFFFFFFFFFFFF";
serialport.on("open", function () {
  var frame_obj = {
    // AT Request to be sent
    type: C.FRAME_TYPE.AT_COMMAND,
    command: "NI",
    commandParameter: [],
  };
  xbeeAPI.builder.write(frame_obj);

  frame_obj = {
    // AT Request to be sent
    type: C.FRAME_TYPE.REMOTE_AT_COMMAND_REQUEST,
    destination64: BROADCAST_ADDRESS,
    command: "NI",
    commandParameter: [],
  };
  xbeeAPI.builder.write(frame_obj);
});

// All frames parsed by the XBee will be emitted here
xbeeAPI.parser.on("data", function (frame) {
  //on new device is joined, register it
  if (C.FRAME_TYPE.JOIN_NOTIFICATION_STATUS === frame.type) {
    console.log(
      "New device has joined network, you can register has new device available"
    );
  }

  if (C.FRAME_TYPE.ZIGBEE_RECEIVE_PACKET === frame.type) {
    console.log("C.FRAME_TYPE.ZIGBEE_RECEIVE_PACKET");
    let dataReceived = String.fromCharCode.apply(null, frame.data);
    console.log(">> ZIGBEE_RECEIVE_PACKET >", dataReceived);
    var text = Buffer.from(frame.data).toString("hex");
    console.log(">> ZIGBEE_RECEIVE_PACKET_FORMATED >", text);
    const listText = text.split("/");
    var temp = listText[0];
    var hum = listText[1];
    var light = listText[2];
    var data = [temp, hum, light];
    client.publish("plante/stats", data);
    console.log("Transmitted data : ", data);
  }

  if (C.FRAME_TYPE.NODE_IDENTIFICATION === frame.type) {
    // let dataReceived = String.fromCharCode.apply(null, frame.nodeIdentifier);
    console.log("NODE_IDENTIFICATION");
  } else if (C.FRAME_TYPE.AT_COMMAND_RESPONSE == frame.type) {
    console.log("AT_COMMAND_RESPONSE");
  } else if (C.FRAME_TYPE.ZIGBEE_IO_DATA_SAMPLE_RX === frame.type) {
    console.log("ZIGBEE_IO_DATA_SAMPLE_RX");
    // console.log("envoyé par esteban", frame)
    console.log(frame.digitalSamples.DIO1);
    console.log(frame.digitalSamples.DIO2);
    // console.log(frame.analogSamples.AD2)
    // if(frame.digitalSamples.DIO0 === 0 ){
    //   eteindreLampe()

    /*
      // if(frame.digitalSamples.DIO1 === 0 ){
      //   ouvrirValve()

      // }
      // if(frame.digitalSamples.DIO2 === 0 ){
      //   fermerValve()
      // }
    */
    if (frame.analogSamples.AD0 === 0) {
      fermerValve();
    }
    if (frame.analogSamples.AD0 !== 0) {
      ouvrirValve();
    }
    if (test === true) {
      ouvrirValve;
    }
    if (test === false) {
      fermerValve;
    }
    // if(frame.analogSamples.AD3 = 300 && !t ){
    //   allumerLampe()
    // }

    // if(frame.analogSamples.AD2 < 300 && t ){
    //   eteindreLampe()
    // }
  } else if (C.FRAME_TYPE.REMOTE_COMMAND_RESPONSE === frame.type) {
    console.log("REMOTE_COMMAND_RESPONSE");
  } else {
    console.log("Other response");
    console.debug(frame);
    let dataReceived = String.fromCharCode.apply(null, frame.commandData);
    console.log(dataReceived);
  }
});

function ouvrirValve() {
  console.log("Sending command to turn on the valve...");
  const frame_obj = {
    type: C.FRAME_TYPE.AT_COMMAND,
    command: "D2",
    commandParameter: [0x04],
  };
  xbeeAPI.builder.write(frame_obj);
  client.publish("plante/valve", "Command sent: Turn on valve");
  console.log("Command sent: Turn on valve");
}

function fermerValve() {
  console.log("Sending command to turn off the valve...");
  const frame_obj = {
    type: C.FRAME_TYPE.AT_COMMAND,
    command: "D2",
    commandParameter: [0x05],
  };
  xbeeAPI.builder.write(frame_obj);
  client.publish("plante/valve", "Command sent: Turn off valve");
  console.log("Command sent: Turn off valve");
}

// function getStatusLampe(){
//   console.log("Getting status of light");
//   const frame_obj = {
//     type: C.FRAME_TYPE.AT_COMMAND,
//     command: "D0",
//     commandParameter: [],
//   };
//   xbeeAPI.builder.write(frame_obj);
//   return true
// }

// function testEnvoie(){
//   console.log("envoie");
//   const frame_obj = {
//     type: C.FRAME_TYPE.ZIGBEE_TRANSMIT_REQUEST,
//     destination64: test,
//     data: "TxData0A"

//   };
//   xbeeAPI.builder.write(frame_obj);
// }

// function eteindreLampe() {
//   console.log("Sending command to turn off the lamp...");
//   const frame_obj = {
//     type: C.FRAME_TYPE.AT_COMMAND,
//     command: "D0",
//     commandParameter: [0x04],
//   };
//   xbeeAPI.builder.write(frame_obj);
//   console.log("Command sent: Turn off lamp");
// }

// function allumerLampe() {
//   console.log("Sending command to turn on the lamp...");
//   const frame_obj = {
//     type: C.FRAME_TYPE.AT_COMMAND,
//     command: "D0",
//     commandParameter: [0x05],
//   };
//   xbeeAPI.builder.write(frame_obj);
//   console.log("Command sent: Turn on lamp");
// }
