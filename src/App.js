import React from 'react';
import './App.css';
import { SPIFlash } from './spiFlash.js';

class App extends React.Component{
    #port;
    /** @type {SPIFlash} */
    #spiFlash;
    
    state = {

    }

    async onOpenButtonClick(){
        this.#port = await navigator.serial.requestPort();
        await this.#port.open({baudRate:115200});
        console.log('port opened');

        const writer = this.#port.writable.getWriter();
        const reader = this.#port.readable.getReader();
        this.#spiFlash = new SPIFlash({reader,writer});
    }
    async onStartTestButtonClick(){
        if(this.#spiFlash){
            let result = this.#spiFlash.sendCommand({
                command:SPIFlash.COMMANDS.readData,
                writeData:new Uint8Array([0,0,0]),
                readLen:256
            });
            console.log(result);
        }
    }
    render(){
        return (
            <div className='App'>
                <button onClick={this.onOpenButtonClick.bind(this)}>Open serial</button>
                <button onClick={this.onStartTestButtonClick.bind(this)}>Start test</button>
            </div>
        );
    }
}


export default App;
