/* (C) Stefan John / Stenway / ReliableTXT.com / 2021 */

"use strict";

class ReliableTxtLines {
	static join(...lines) {
		return lines.join('\n');
	}
	
	static split(text) {
		return text.split('\n');
	}		
}

class ReliableTxtUtil {
	static getCodePoints(str) {
		return Array.from(str).map(c => c.codePointAt(0));
	}
	
	static getStringFromCodePoints(...codePoints) {
		return String.fromCodePoint(...codePoints);
	}
}

const ReliableTxtEncoding = Object.freeze({
	UTF_8: 0,
	UTF_16: 1,
	UTF_16_REVERSE: 2,
	UTF_32: 3
});

class ReliableTxtEncoder {
	static encode(text, encoding) {
		let textWithPreamble = "\uFEFF" + text;
		if (encoding === ReliableTxtEncoding.UTF_8) {
			let utf8Encoder = new TextEncoder();
			return utf8Encoder.encode(textWithPreamble);
		} else if (encoding === ReliableTxtEncoding.UTF_16) {
			return ReliableTxtEncoder._encodeUTF16(textWithPreamble, false);
		} else if (encoding === ReliableTxtEncoding.UTF_16_REVERSE) {
			return ReliableTxtEncoder._encodeUTF16(textWithPreamble, true);
		} else if (encoding === ReliableTxtEncoding.UTF_32) {
			return ReliableTxtEncoder._encodeUTF32(textWithPreamble);
		}
	}
	
	static _encodeUTF16(textWithPreamble, reversed) {
		let buffer = new ArrayBuffer(textWithPreamble.length*2);
		let byteArray = new Uint8Array(buffer);
		let byte1Offset = reversed ? 1 : 0;
		let byte2Offset = reversed ? 0 : 1;;
		for (let i=0; i < textWithPreamble.length; i++) {
			let charCode = textWithPreamble.charCodeAt(i);
			byteArray[2*i+byte1Offset] = (charCode & 0xFF00) >> 8;
			byteArray[2*i+byte2Offset] = charCode & 0xFF;
		}
		return byteArray;
	}
	
	static _encodeUTF32(textWithPreamble) {
		let codePoints = ReliableTxtUtil.getCodePoints(textWithPreamble);
		let buffer = new ArrayBuffer(codePoints.length*4);
		let byteArray = new Uint8Array(buffer);
		for (let i=0; i<codePoints.length; i++) {
			let codePoint = codePoints[i];
			byteArray[4*i] = (codePoint & 0xFF000000) >> 24;
			byteArray[4*i+1] = (codePoint & 0xFF0000) >> 16;
			byteArray[4*i+2] = (codePoint & 0xFF00) >> 8;
			byteArray[4*i+3] = codePoint & 0xFF;
		}
		return byteArray;
	}
}

class ReliableTxtDecoder {
	static getEncoding(bytes) {
		if (bytes.length >= 3
				&& bytes[0] == 0xEF 
				&& bytes[1] == 0xBB
				&& bytes[2] == 0xBF) {
			return ReliableTxtEncoding.UTF_8;
		} else if (bytes.length >= 2
				&& bytes[0] == 0xFE 
				&& bytes[1] == 0xFF) {
			return ReliableTxtEncoding.UTF_16;
		} else if (bytes.length >= 2
				&& bytes[0] == 0xFF 
				&& bytes[1] == 0xFE) {
			return ReliableTxtEncoding.UTF_16_REVERSE;
		} else if (bytes.length >= 4
				&& bytes[0] == 0 
				&& bytes[1] == 0
				&& bytes[2] == 0xFE 
				&& bytes[3] == 0xFF) {
			return ReliableTxtEncoding.UTF_32;
		} else {
			throw new Error("Document does not have a ReliableTXT preamble");
		}
	}
	
	static decode(bytes) {
		let encoding = ReliableTxtDecoder.getEncoding(bytes);
		let text = null;
		if (encoding === ReliableTxtEncoding.UTF_8) {
			let utf8Decoder = new TextDecoder("utf-8", {fatal: true});
			text = utf8Decoder.decode(bytes);
		} else if (encoding === ReliableTxtEncoding.UTF_16) {
			let utf16Decoder = new TextDecoder("utf-16be", {fatal: true});
			text = utf16Decoder.decode(bytes);
		} else if (encoding === ReliableTxtEncoding.UTF_16_REVERSE) {
			let utf16ReverseDecoder = new TextDecoder("utf-16le", {fatal: true});
			text = utf16ReverseDecoder.decode(bytes);
		} else if (encoding === ReliableTxtEncoding.UTF_32) {
			text = ReliableTxtDecoder._decodeUTF32(bytes);
		}
		return [encoding, text];
	}
	
	static _decodeUTF32(bytes) {
		let numCodePoints = bytes.length/4;
		let text = "";
		for (let i=1; i<numCodePoints; i++) {
			let codePoint = bytes[4*i] << 24 | bytes[4*i+1] << 16 | bytes[4*i+2] << 8 | bytes[4*i+3];
			text += String.fromCodePoint(codePoint);
		}
		return text;
	}
}

class ReliableTxtDocument {
	constructor(text = "", encoding = ReliableTxtEncoding.UTF_8) {
		this.setText(text);
		this.setEncoding(encoding);
	}
	
	getText() {
		return this._text;
	}
	
	setText(text) {
		this._text = text;
	}
	
	getEncoding() {
		return this._encoding;
	}
	
	setEncoding(encoding) {
		this._encoding = encoding;
	}
	
	setLines(...lines) {
		let text = ReliableTxtLines.join(...lines);
		this.setText(text);
	}
	
	getLines() {
		return ReliableTxtLines.split(this._text);
	}
	
	getCodePoints() {
		return ReliableTxtUtil.getCodePoints(this._text);
	}
	
	setCodePoints(...codePoints) {
		this.setText(ReliableTxtUtil.getStringFromCodePoints(...codePoints));
	}
	
	getBytes() {
		return ReliableTxtEncoder.encode(this._text, this._encoding);
	}
	
	getDownloadUrl() {
		var bytes = this.getBytes();
		const blob = new Blob([bytes], { type: 'text/plain' });
		return URL.createObjectURL(blob);
	}
	
	save(fileName) {
		const url = this.getDownloadUrl();
		let element = document.createElement('a');
		element.href = url;
		element.download = fileName;
		element.style.display = 'none';
		document.body.appendChild(element);
		element.click();
		document.body.removeChild(element);
	}
	
	static loadFromBytes(bytes) {
		let decoderResult = ReliableTxtDecoder.decode(bytes);
		return new ReliableTxtDocument(decoderResult[1], decoderResult[0]);
	}
}