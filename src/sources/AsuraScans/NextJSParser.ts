// @ts-ignore
import { TextEncoder, TextDecoder } from '@sinonjs/text-encoding'

export class NextJSParser {
    public rawContent: string
    private propertyToKeyCache: Map<string, string | null> | undefined

    private textEncoder: TextEncoder
    private textDecoder: TextDecoder

    private bufferArray: string[]
    private currentChunk: string
    private currentChunkInByteArray: number[]
    private expectedByteArrayLength: number
    constructor($: CheerioStatic, rememberKeyForProperties: string[] | null = null) {
        this.textEncoder = new TextEncoder()
        this.textDecoder = new TextDecoder()

        this.rawContent = ''
        this.bufferArray = []
        this.currentChunk = ''
        this.currentChunkInByteArray = []
        this.expectedByteArrayLength = 0

        if (rememberKeyForProperties) {
            this.propertyToKeyCache = new Map(Array.from(rememberKeyForProperties, (propName) => [
                propName,
                null
            ]))
        }

        this.parseNextJSData($, rememberKeyForProperties)
    }

    private parseNextJSData($: CheerioStatic, rememberKeyForProperties: string[] | null) {
        const scriptsWithData = $('script')
            .toArray()
            .filter((script) => {
                const scriptContent = $(script).html()
                return scriptContent?.includes('self.__next_f.push')
            })
        if (scriptsWithData.length === 0) {
            throw new Error('Could not find script with data')
        }

        for (const scriptWithData of scriptsWithData) {
            const self = {
                __next_f: []
            }

            const scriptContent = $(scriptWithData).html()
            if (!scriptContent) continue
            eval(scriptContent)
            self.__next_f.forEach((val: [number, undefined | null | string]) => {
                if (val[0] === 1) {
                    this.rawContent += val[1] as unknown as string
                }
            })
        }

        this.rawContent.split('\n').forEach((line, idx) => {
            if (line === '') {
                return
            }

            this.transformSerializedBufferLine(line)
        })
    }

    private processSerializedBufferLine(line: string, idx?: number): void {
        if (idx !== undefined) {
            this.bufferArray[idx] = line
            return
        }
        // This should only process a line which has been preprocessed to ensure it is a valid buffer line
        // Therefore, this method does not check for validity and trusts the input
        const strSplitIndex = line.indexOf(':')
        if (strSplitIndex === -1) {
            return
        }
        const hexIndex = line.slice(0, strSplitIndex)
        const intIndex = parseInt(hexIndex, 16)
        const value = line.slice(strSplitIndex + 1)
        this.bufferArray[intIndex] = value

        if (this.propertyToKeyCache?.size) {
            for (const [key, propertyValue] of this.propertyToKeyCache) {
                if (propertyValue) continue

                if (!this.propertyToKeyCache.get(key)) {
                    if (value.indexOf(`"${key}":`) > -1) {
                        this.propertyToKeyCache.set(key, hexIndex)
                    }
                }
            }
        }
    }

    private transformSerializedBufferLine(line: string): void {
        line += '\n'

        if (this.expectedByteArrayLength === 0) {

            const strSplitIndex = line.indexOf(':')
            if (strSplitIndex === -1) {
                console.log(
                    `Hi, this is the edgecase: ${line}; ${this.currentChunk}, ${this.currentChunkInByteArray.length}, ${this.expectedByteArrayLength}`
                )
                throw new Error(
                    'Uncaught edgecase, please report to get this fixed!'
                )
            }
            if (line[strSplitIndex + 1] !== 'T') {
                this.processSerializedBufferLine(line)
            } else {
                const commaIndex = line.indexOf(',')
                const length = line.match(/T([0-9a-fA-F]+),/)?.[1]
                if (length && commaIndex !== -1) {
                    this.expectedByteArrayLength = parseInt(length, 16)
                    const countableChunk = line.slice(commaIndex + 1)
                    const countableByteArray: Uint8Array =
                        this.textEncoder.encode(countableChunk)
                    if (
                        countableByteArray.length ===
                        this.expectedByteArrayLength
                    ) {
                        const idx = parseInt(line.slice(0, strSplitIndex), 16)
                        this.processSerializedBufferLine(countableChunk, idx)
                        this.currentChunk = ''
                        this.currentChunkInByteArray = []
                        this.expectedByteArrayLength = 0
                    } else if (
                        countableByteArray.length > this.expectedByteArrayLength
                    ) {
                        this.currentChunkInByteArray =
                            this.currentChunkInByteArray.concat(
                                Array.from(countableByteArray)
                            )
                        this.currentChunk += line

                        const toTraverseLength =
                            this.expectedByteArrayLength -
                            this.currentChunkInByteArray.length
                        const actualChunkByteArray =
                            this.currentChunkInByteArray.slice(
                                0,
                                toTraverseLength
                            )
                        const actualChunk = this.textDecoder.decode(
                            Uint8Array.from(actualChunkByteArray)
                        )
                        const otherChunk = this.textDecoder.decode(
                            Uint8Array.from(
                                this.currentChunkInByteArray.slice(
                                    toTraverseLength
                                )
                            )
                        )

                        this.processSerializedBufferLine(
                            actualChunk,
                            parseInt(
                                this.currentChunk.slice(0, strSplitIndex),
                                16
                            )
                        )
                        this.transformSerializedBufferLine(otherChunk)
                    } else {
                        this.currentChunk = line
                        this.currentChunkInByteArray =
                            this.currentChunkInByteArray.concat(
                                Array.from(
                                    this.textEncoder.encode(countableChunk)
                                )
                            )
                    }
                } else {
                    throw new Error(
                        `An error occurred while processing '${this.currentChunk}', found length: '${length}', commaIndex: '${commaIndex}'`
                    )
                }
            }
        } else {
            this.currentChunkInByteArray = this.currentChunkInByteArray.concat(
                Array.from(this.textEncoder.encode(line))
            )
            this.currentChunk += line
            if (
                this.currentChunkInByteArray.length ===
                this.expectedByteArrayLength
            ) {
                this.processSerializedBufferLine(
                    this.textDecoder.decode(
                        Uint8Array.from(this.currentChunkInByteArray)
                    )
                )
                this.currentChunk = ''
                this.expectedByteArrayLength = 0
                this.currentChunkInByteArray = []
            } else if (
                this.currentChunkInByteArray.length >
                this.expectedByteArrayLength
            ) {
                const toTraverseLength =
                    this.expectedByteArrayLength -
                    this.currentChunkInByteArray.length

                const actualChunkByteArray = this.currentChunkInByteArray.slice(
                    0,
                    toTraverseLength
                )
                const actualChunk = this.textDecoder.decode(
                    Uint8Array.from(actualChunkByteArray)
                )
                const otherChunk = this.textDecoder.decode(
                    Uint8Array.from(
                        this.currentChunkInByteArray.slice(toTraverseLength)
                    )
                )

                const strSplitIndex = this.currentChunk.indexOf(':')
                this.processSerializedBufferLine(
                    actualChunk,
                    parseInt(this.currentChunk.slice(0, strSplitIndex), 16)
                )
                this.expectedByteArrayLength = 0
                this.currentChunk = ''
                this.currentChunkInByteArray = []
                this.transformSerializedBufferLine(otherChunk)
            }
        }
    }

    public getKeyForProperty(propertyName: string): string | null {
        return this.propertyToKeyCache?.get(propertyName) ?? null
    }

    public getReferenceKeyForProperty(propertyName: string): string | null {
        const pointerRegex = new RegExp(`"${propertyName}":"\\\$([0-9a-fA-F]+)"`, 'm')
        const match = this.rawContent.match(pointerRegex)
        return match?.[1] ?? null
    }

    public get(index: number): string | null {
        return this.bufferArray[index] ?? null
    }

    public getByHex(hexIndex: string): string | null {
        const intIndex = parseInt(hexIndex, 16)
        return this.get(intIndex)
    }

    private replacePointers(text: string, maxDepth: number = 64, _currentDepth: number = 0): string {
        const pointerRegex = /\$[0-9a-fA-F]+/g

        let json: any
        try {
            json = JSON.parse(text)
        } catch (error) {}

        if (json) {
            return JSON.stringify(json, (key, value) => {
                if (typeof value === 'string'
                    && _currentDepth < maxDepth
                    && value.match(pointerRegex)) {
                    _currentDepth++
                    return this.replacePointers(value, maxDepth, _currentDepth)
                }

                return value
            })
        }
        return text.replace(pointerRegex, (match) => {
            const key = match.slice(1)
            const value = this.getByHex(key)

            if (value?.match(pointerRegex) && _currentDepth < maxDepth) {
                _currentDepth++
                return this.replacePointers(value, maxDepth, _currentDepth)
            }

            return value ?? match
        })
    }

    public getObjectByKey(key: string): any {
        const bufferEntry = this.getByHex(key)
        if (!bufferEntry) {
            throw new Error(`Key ${key} not found`)
        }
        const endResult = this.replacePointers(bufferEntry)
        return this.recurseParseJSON(endResult)
    }

    private recurseParseJSON(value: string | object): string | object {
        if (typeof value === 'string') {
            try {
                const json = JSON.parse(value)
                return this.recurseParseJSON(json)
            } catch (error) {
                return value
            }
        } else if (typeof value === 'object') {
            for (const key in value) {
                ;(value as { [key: string]: any })[key] = this.recurseParseJSON(
                    (value as { [key: string]: any })[key]
                )
            }
        } else if (Array.isArray(value)) {
            ;(value as []).forEach((element, index) => {
                ;(value as any[])[index] = this.recurseParseJSON(element)
            })
        }
        return value
    }
}