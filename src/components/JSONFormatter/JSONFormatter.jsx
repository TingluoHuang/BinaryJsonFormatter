import React, { Component } from "react";
import Button from '@material-ui/core/Button';
import { MuiThemeProvider, createMuiTheme } from '@material-ui/core/styles';
import { UnControlled as CodeMirror } from 'react-codemirror2'

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
      if (!input.startsWith("0x")) {
        throw new Error("input needs to be a Hex String starts with '0x'.");
      }
      input = input.substring(2);
      var hex = Buffer.from(input, 'hex');
      if (input.toLowerCase().startsWith("1f8b")) {
        // gzip string, need to unzip first
        hex = zlib.gunzipSync(hex);
      }
      var jsonString = hex.toString('utf-8');
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
    var outputText, outputClass;
    try {
      outputText = this.formatJSON(this.state.inputText);
      outputClass = 'output-good';
    }
    catch (err) {
      // JSON.parse threw an exception
      outputText = 'It looks like there was an error with your JSON---\n\n' + err.message;
      outputClass = 'output-error';
    }

    return outputText
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
          <span style={{ fontFamily: "Roboto", fontSize: 22, fontWeight: 300, marginBottom: 20 }}>Raw JSON Binary:</span>
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