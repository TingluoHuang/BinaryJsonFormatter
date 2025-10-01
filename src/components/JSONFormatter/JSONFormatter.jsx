import React, { Component } from "react";
import { MuiThemeProvider, createMuiTheme } from '@material-ui/core/styles';
import { UnControlled as CodeMirror } from 'react-codemirror2'
import SnappyJS from 'snappyjs'
import { Buffer } from "buffer";
import { decode, encode } from "@msgpack/msgpack";
import { Reader } from "protobufjs";

const zlib = require('zlib');
require('codemirror/mode/javascript/javascript');
require('codemirror/lib/codemirror.css');
require('codemirror/theme/material.css');

// MaterialUI Theme Options: https://material-ui.com/customization/themes/#theme-configuration-variables
const theme = createMuiTheme({
  palette: {
    primary: {
      main: '#253237', // Dark Blue
      contrastText: '#AAA', // Grey
    }
  },
});

const prefixToTypeName = {
  R: "Repository",
  U: "User",
  O: "Organization",
  CR: "CheckRun",
  CS: "CheckSuite",
  BOT: "Bot",
  E: "Business",
  EN: "Environment",
  M: "Mannequin",
  A: "App",
  GA: "Gate",
};

// Helper function to parse protobuf buffer and extract field information
function parseProtobufBuffer(buffer) {
  const reader = new Reader(buffer);
  const fields = {};
  
  while (reader.pos < reader.len) {
    const tag = reader.uint32();
    const fieldNumber = tag >>> 3;
    const wireType = tag & 7;
    
    let value;
    switch (wireType) {
      case 0: // Varint
        value = reader.uint64().toString();
        break;
      case 1: // 64-bit
        value = reader.fixed64().toString();
        break;
      case 2: // Length-delimited
        const bytes = reader.bytes();
        // Try to parse as string, fallback to hex
        try {
          value = new TextDecoder().decode(bytes);
          // If it contains non-printable characters, show as hex
          if (!/^[\x20-\x7E]*$/.test(value)) {
            value = Buffer.from(bytes).toString('hex');
          }
        } catch {
          value = Buffer.from(bytes).toString('hex');
        }
        break;
      case 3: // Start group (deprecated)
        value = "start_group";
        break;
      case 4: // End group (deprecated)
        value = "end_group";
        break;
      case 5: // 32-bit
        value = reader.fixed32();
        break;
      default:
        value = "unknown_wire_type";
    }
    
    fields[`field_${fieldNumber}`] = {
      field_number: fieldNumber,
      wire_type: wireType,
      wire_type_name: getWireTypeName(wireType),
      value: value
    };
  }
  
  return fields;
}

function getWireTypeName(wireType) {
  const wireTypeNames = {
    0: "VARINT",
    1: "I64", 
    2: "LEN",
    3: "SGROUP",
    4: "EGROUP", 
    5: "I32"
  };
  return wireTypeNames[wireType] || "UNKNOWN";
}

// Additional CodeMirror options can be found here: https://github.com/JedWatson/react-codemirror
var inputOptions = {
  lineNumbers: true,
  mode: { name: 'javascript', json: true },
  theme: 'material',
  autofocus: true // Input box will take user input on page load
};

var outputOptions = {
  lineNumbers: true,
  mode: { name: 'javascript', json: true },
  theme: 'material',
  readOnly: true
};

class FormattedJSON extends Component {
  render() {
    return (
      <div>
        <CodeMirror
          ref="editor"
          value={this.props.inputText}
          options={outputOptions}
          autoFocus={true}
          onChange={() => { }}
          preserveScrollPosition={true}
        />
        <br />
      </div>
    );
  }
}

export class JSONFormatter extends Component {
  onInputTextChange = (event, data, value) => {
    try {
      this.setState({ 'inputText': event.target.value });
    } catch (err) {
      this.setState({ 'inputText': value });
    }
  };

  formatJSON(input) {
    if (input) {
      var jsonString = "";
      if (!input.startsWith("0x")) {
        input = input.replace(/\r?\n|\r/g, "");
        // check whether the input is a base64 string and then try use snappy to decompress it
        var base64regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
        var intRegex = /^[0-9]+$/;
        if (base64regex.test(input)) {
          try {
            // First try snappy decompression
            var uncompressed = SnappyJS.uncompress(Buffer.from(input, 'base64'));
            let utf8decoder = new TextDecoder()
            jsonString = utf8decoder.decode(uncompressed);
          } catch (snappyError) {
            try {
              // If snappy fails, try protobuf parsing
              const protobufBuffer = Buffer.from(input, 'base64');
              const parsedProtobuf = parseProtobufBuffer(protobufBuffer);
              jsonString = JSON.stringify({
                type: "protobuf_message",
                fields: parsedProtobuf
              }, null, 4);
            } catch (protobufError) {
              throw new Error("Unable to parse as snappy-compressed or protobuf data: " + protobufError.message);
            }
          }
        }
        else if (intRegex.test(input)) {
          var intValue = parseInt(input, 10); // base 10
          var ids = [0, intValue]; // Example: Wrap it in an array
          var encodedBuffer = encode(ids);
          var base64WithoutPadding = Buffer.from(encodedBuffer).toString('base64').replace(/=+$/, '');

          var protential_json = {};
          protential_json["Enterprise"] = 'E_' + base64WithoutPadding;
          protential_json["Organization"] = 'O_' + base64WithoutPadding;
          protential_json["User"] = 'U_' + base64WithoutPadding;
          protential_json["Repository"] = 'R_' + base64WithoutPadding;
          jsonString = JSON.stringify(protential_json, null, 4);
        }
        else {
          var parts = input.split('_', 2);
          if (parts.length !== 2) {
            throw new Error("input needs to be a Hex String starts with '0x', valid base64 string or a valid global relay id string.");
          }

          const [typeHint, idPart] = parts;
          const typeName = prefixToTypeName[typeHint];
          if (!typeName) {
            throw new Error("input needs to be a Hex String starts with '0x', valid base64 string or a valid global relay id string.");
          }

          const trimmed = idPart.trim();
          if (!trimmed) {
            throw new Error("input needs to be a Hex String starts with '0x', valid base64 string or a valid global relay id string.");
          }

          const packedMsg = Buffer.from(trimmed, 'base64');
          const decoded = decode(packedMsg);
          if (!Array.isArray(decoded) || decoded.length < 2) {
            throw new Error("input needs to be a Hex String starts with '0x', valid base64 string or a valid global relay id string.");
          }

          const idInt = decoded[decoded.length - 1];

          var json = {};
          json["type"] = typeName;
          json["id"] = idInt;
          jsonString = JSON.stringify(json, null, 4);
        }
      }
      else {
        input = input.substring(2);
        var hex = Buffer.from(input, 'hex');
        if (input.toLowerCase().startsWith("1f8b")) {
          // gzip string, need to unzip first
          hex = zlib.gunzipSync(hex);
        }
        jsonString = hex.toString('utf-8');
      }

      var parsedData = JSON.parse(jsonString);
      var outputText = JSON.stringify(parsedData, null, 4);
      return outputText;
    }
    else {
      return '';
    }
  }

  getJSONData() {
    // eslint-disable-next-line
    var outputText;
    try {
      outputText = this.formatJSON(this.state.inputText);
      if (outputText === "") {
        outputText = this.state.jobText;
      }
    }
    catch (err) {
      // JSON.parse threw an exception
      outputText = 'It looks like there was an error with your input---\n\n' + err.message;
    }

    return outputText
  }

  getJoke() {
    fetch('https://geek-jokes.sameerkumar.website/api?format=json')
      .then((response) => response.json())
      .then((responseJson) => {
        this.setState({ jobText: responseJson.joke })
      })
      .catch((error) => {
        console.error(error);
      });
  }

  componentWillMount() {
    this.getJoke();
  }

  UNSAFE_componentWillMount() {
    this.setState({
      inputText: ""
    });
  }

  componentWillUnmount() {
    window.confirm('You are leaving the Binary JSON Formatter.')
  }

  render() {
    return (
      <div>
        <MuiThemeProvider theme={theme}>
          <span style={{ fontFamily: "Roboto", fontSize: 22, fontWeight: 300, marginBottom: 20 }}>Raw JSON Binary or Global ID:</span>
          <div id="formatter"></div>
          <div style={{
            margin: 0,
            padding: 0,
            border: 0,
            fontSize: '100%',
            font: 'inherit',
            verticalAlign: 'baseline',
            width: '99%'
          }}>
            <CodeMirror ref="display" value={this.state.inputText} onChange={this.onInputTextChange} options={inputOptions} preserveScrollPosition={true} autoCursor={false} />
            <br />
            <hr />
            <br />
            <span style={{ fontFamily: "Roboto", fontSize: 22, fontWeight: 300, marginBottom: 20 }}>Formatted JSON:</span>
            <FormattedJSON
              inputText={this.getJSONData()}
            />
            <br />
          </div>
        </MuiThemeProvider>
      </div>
    );
  }
}

export default JSONFormatter;