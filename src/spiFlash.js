// @ts-check

export class SPIFlash{
    static COMMANDS = {
        wirteEnable:0x06,
        volatileSRWriteEnable:0x50,
        writeDisable:0x04,
        readStatusReg1:0x05,
        readStatusReg2:0x35,
        writeStatusReg:0x01,
        pageProgram:0x02,
        sectorErase:0x20,
        blockErase32k:0x52,
        blockErase64k:0xD8,
        chipErase:0xC7,
        chipEraseAlt:0x60,
        eraseProgramSuspend:0x75,
        eraseProgramResume:0x7A,
        powerDown:0xB9,
        readData:0x03,
        fastRead:0x0B,
        releasePowerdown:0xAB,
        deviceId:0x90,
        JEDECId:0x9F,
        readUniqueId:0x4B,
        readSFDPReg:0x5A,
        eraseSecurityReg:0x42,
        readSecurityReg:0x48,
        enableQPI:0x38,
        enableReset:0x66,
        reset:0x99
    };
    static CODES = {
        success:0,
        error:1
    };

    #reader;
    #writer;
    /** @type {((value:Uint8Array)=>void)|undefined} */
    #pendingPromiseResolve;
    /** @type {((reason:any)=>void)|undefined} */
    #pendingPromiseReject;
    /** @type {number|undefined} */
    #pendingDataToRead;
    #busy = false;
    /**
     * @param {{
     *      reader:ReadableStreamDefaultReader<Uint8Array>
     *      writer:WritableStreamDefaultWriter<Uint8Array>
     * }} params 
     */
    constructor(params) {
        this.#reader = params.reader;
        this.#writer = params.writer;
        this.readTask();
    }

    async readTask(){
        /** @type {Array<Uint8Array>} */
        let rxBuffer = [];
        for(;;){
            const {value,done} = await this.#reader.read();
            if(done){
                break;
            }
            /** handle incoming data */
            if((this.#pendingPromiseResolve===undefined)||
                (this.#pendingPromiseReject===undefined)||
                (this.#pendingDataToRead===undefined)){
                /** should not happen */
                continue;
            }
            rxBuffer.push(value);
            let rxLen = rxBuffer.map(array=>array.byteLength).reduce((a,b)=>a+b);
            if(rxLen>=(this.#pendingDataToRead+3)){
                let rxArray = new Uint8Array(rxLen);
                let offset = 0;
                for(const array of rxBuffer){
                    rxArray.set(array,offset);
                    offset+=array.length;
                }
                rxBuffer = [];
                let code = rxArray[0];
                if(code===SPIFlash.CODES.error){
                    this.#pendingPromiseReject('Flash error');
                    continue;
                }
                let dataLen = (rxArray[2]<<8)|rxArray[1];
                if(dataLen !== this.#pendingDataToRead){
                    this.#pendingPromiseReject('Wrong data length');
                    continue;
                }
                let result = rxArray.slice(3,3+dataLen);
                this.#pendingPromiseResolve(result);
            }
        }
    }

    /**
     * @param {{
     *      command:number,
     *      waitBusy?:boolean,
     *      writeData?:Uint8Array,
     *      readLen?:number
     * }} params 
     * @returns {Promise<Uint8Array>}
     */
    async sendCommand(params){
        if(this.#busy){
            throw new Error('Flash is busy');
        }
        this.#busy = true;
        let reply = await new Promise(async (resolve,reject)=>{
            this.#pendingPromiseResolve = resolve;
            this.#pendingPromiseReject = reject;
            this.#pendingDataToRead = params.readLen??0;
            /** send data */
            let writeLen = params.writeData?.byteLength??0;
            let readLen = params.readLen??0;
            let txHeader = new Uint8Array([
                params.command,
                params.waitBusy?0x01:0x00,
                writeLen&0xFF,
                (writeLen>>>8)&0xFF,
                readLen&0xFF,
                (readLen>>>8)&0xFF
            ]);
            await this.#writer.write(txHeader);
            if(params.writeData!==undefined && params.writeData.byteLength>0){
                await this.#writer.write(params.writeData);
            }
        });
        this.#pendingPromiseResolve = undefined;
        this.#pendingPromiseReject = undefined;
        this.#busy = false;
        return reply;
    }
}