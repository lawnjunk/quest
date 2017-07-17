'use strict';

require('./style/main.scss')

import React from 'react'
import ReactDOM from 'react-dom'

class App extends React.Component {
  constructor(props){
    super(props);
  }

  render() {
    return (
      <div className="app">
        <p> hello world </p>
      </div>
    );
  }
}

var root = document.createElement('div')
root.className = 'app-container'
document.body.appendChild(root)

ReactDOM.render(<App />, root)
