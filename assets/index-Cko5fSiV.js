import { promises } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path, { join } from 'path';
import os from 'os';
import { toBase64, fromHex, fromBase64 } from '@cosmjs/encoding';
import { Registry, makeSignDoc, DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { defaultRegistryTypes, StargateClient, SigningStargateClient, calculateFee, coins as coins$1, coin as coin$1 } from '@cosmjs/stargate';
import { BinaryWriter, BinaryReader } from '@bufbuild/protobuf/wire';
import { MsgSubmitProposal, MsgDeposit, MsgVote, MsgVoteWeighted, MsgExecLegacyContent, MsgUpdateParams as MsgUpdateParams$1 } from 'cosmjs-types/cosmos/gov/v1/tx.js';
import Long from 'long';
import { TxRaw, SignDoc, TxBody } from 'cosmjs-types/cosmos/tx/v1beta1/tx.js';
import { Any } from 'cosmjs-types/google/protobuf/any.js';
import { fileURLToPath } from 'url';
import { bech32 } from 'bech32';
import { generateMnemonic } from 'bip39';
import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx.js';
import { sha256 } from '@noble/hashes/sha256';

var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/pqc/constants.ts
var PQC_PREFIX, PQC_TYPE_URL, PQC_STORE_DIRNAME, PQC_KEYS_FILE, PQC_LINKS_FILE, DEFAULT_SCHEME, DILITHIUM3_PUBLIC_KEY_BYTES, DILITHIUM3_PRIVATE_KEY_BYTES, DILITHIUM3_SIGNATURE_BYTES;
var init_constants = __esm({
  "src/pqc/constants.ts"() {
    PQC_PREFIX = "PQCv1:";
    PQC_TYPE_URL = "/lumen.pqc.v1.PQCSignatures";
    PQC_STORE_DIRNAME = "pqc_keys";
    PQC_KEYS_FILE = "keys.json";
    PQC_LINKS_FILE = "links.json";
    DEFAULT_SCHEME = "dilithium3";
    DILITHIUM3_PUBLIC_KEY_BYTES = 1952;
    DILITHIUM3_PRIVATE_KEY_BYTES = 4e3;
    DILITHIUM3_SIGNATURE_BYTES = 3293;
  }
});

// src/pqc/keystore.ts
var keystore_exports = {};
__export(keystore_exports, {
  PqcKeyStore: () => PqcKeyStore,
  defaultHomeDir: () => defaultHomeDir
});
async function readJson(path2, fallback) {
  try {
    const data = await readFile(path2, "utf8");
    return JSON.parse(data);
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
}
async function writeJson(path2, payload) {
  const tmpPath = `${path2}.tmp`;
  await writeFile(tmpPath, JSON.stringify(payload, null, 2), {
    mode: FILE_MODE
  });
  await promises.rename(tmpPath, path2);
}
function deserializeKey(entry) {
  return {
    name: entry.name,
    scheme: entry.scheme,
    publicKey: fromBase64(entry.publicKey),
    privateKey: fromBase64(entry.privateKey),
    createdAt: new Date(entry.createdAt)
  };
}
function defaultHomeDir() {
  const base = os.homedir();
  if (!base) throw new Error("Unable to resolve user home directory for pqc key store");
  return join(base, ".lumen");
}
var FILE_MODE, PqcKeyStore;
var init_keystore = __esm({
  "src/pqc/keystore.ts"() {
    init_constants();
    FILE_MODE = 384;
    PqcKeyStore = class _PqcKeyStore {
      constructor(keysPath, linksPath, keys, links) {
        this.keysPath = keysPath;
        this.linksPath = linksPath;
        this.keys = keys;
        this.links = links;
      }
      static async open(homeDir = defaultHomeDir()) {
        const dir = join(homeDir, PQC_STORE_DIRNAME);
        await mkdir(dir, { recursive: true, mode: 448 });
        const keysPath = join(dir, PQC_KEYS_FILE);
        const linksPath = join(dir, PQC_LINKS_FILE);
        const keys = await readJson(keysPath, {});
        const links = await readJson(linksPath, {});
        return new _PqcKeyStore(keysPath, linksPath, keys, links);
      }
      listKeys() {
        return Object.values(this.keys).map(deserializeKey);
      }
      getKey(name) {
        const found = this.keys[name];
        return found ? deserializeKey(found) : void 0;
      }
      async saveKey(record) {
        const payload = {
          name: record.name,
          scheme: record.scheme,
          publicKey: toBase64(record.publicKey),
          privateKey: toBase64(record.privateKey),
          createdAt: record.createdAt.toISOString()
        };
        this.keys[record.name] = payload;
        await writeJson(this.keysPath, this.keys);
      }
      listLinks() {
        return { ...this.links };
      }
      getLink(address) {
        return this.links[address];
      }
      async linkAddress(address, keyName) {
        this.links[address] = keyName;
        await writeJson(this.linksPath, this.links);
      }
    };
  }
});

// src/constants.ts
var LUMEN = {
  chainId: "lumen",
  bech32Prefix: "lmn",
  defaultRpc: "http://127.0.0.1:27657",
  defaultRest: "http://127.0.0.1:2327",
  defaultGrpc: "http://127.0.0.1:9190",
  gaslessTypeUrls: [
    "/lumen.gateway.v1.MsgCreateContract",
    "/lumen.gateway.v1.MsgRegisterGateway",
    "/lumen.gateway.v1.MsgUpdateGateway",
    "/lumen.gateway.v1.MsgClaimPayment",
    "/lumen.gateway.v1.MsgCancelContract",
    "/lumen.gateway.v1.MsgFinalizeContract",
    "/lumen.dns.v1.MsgRegister",
    "/lumen.dns.v1.MsgRenew",
    "/lumen.dns.v1.MsgTransfer",
    "/lumen.dns.v1.MsgUpdate",
    "/lumen.dns.v1.MsgBid",
    "/lumen.dns.v1.MsgSettle"
  ]
};
function createBaseRecord() {
  return { key: "", value: "", ttl: 0 };
}
var Record = {
  encode(message, writer = new BinaryWriter()) {
    if (message.key !== "") {
      writer.uint32(10).string(message.key);
    }
    if (message.value !== "") {
      writer.uint32(18).string(message.value);
    }
    if (message.ttl !== 0) {
      writer.uint32(24).uint64(message.ttl);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseRecord();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.key = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.value = reader.string();
          continue;
        }
        case 3: {
          if (tag !== 24) {
            break;
          }
          message.ttl = longToNumber(reader.uint64());
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      key: isSet(object.key) ? globalThis.String(object.key) : "",
      value: isSet(object.value) ? globalThis.String(object.value) : "",
      ttl: isSet(object.ttl) ? globalThis.Number(object.ttl) : 0
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.key !== "") {
      obj.key = message.key;
    }
    if (message.value !== "") {
      obj.value = message.value;
    }
    if (message.ttl !== 0) {
      obj.ttl = Math.round(message.ttl);
    }
    return obj;
  },
  create(base) {
    return Record.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseRecord();
    message.key = object.key ?? "";
    message.value = object.value ?? "";
    message.ttl = object.ttl ?? 0;
    return message;
  }
};
function longToNumber(int64) {
  const num = globalThis.Number(int64.toString());
  if (num > globalThis.Number.MAX_SAFE_INTEGER) {
    throw new globalThis.Error("Value is larger than Number.MAX_SAFE_INTEGER");
  }
  if (num < globalThis.Number.MIN_SAFE_INTEGER) {
    throw new globalThis.Error("Value is smaller than Number.MIN_SAFE_INTEGER");
  }
  return num;
}
function isSet(value) {
  return value !== null && value !== void 0;
}
function createBaseParams() {
  return {
    baseFeeDns: "",
    alpha: "",
    floor: "",
    ceiling: "",
    t: 0,
    graceDays: 0,
    auctionDays: 0,
    transferFeeUlmn: 0,
    bidFeeUlmn: 0,
    updateRateLimitSeconds: 0,
    updatePowDifficulty: 0,
    domainTiers: [],
    extTiers: [],
    minPriceUlmnPerMonth: 0,
    updateFeeUlmn: 0
  };
}
var Params = {
  encode(message, writer = new BinaryWriter()) {
    if (message.baseFeeDns !== "") {
      writer.uint32(10).string(message.baseFeeDns);
    }
    if (message.alpha !== "") {
      writer.uint32(18).string(message.alpha);
    }
    if (message.floor !== "") {
      writer.uint32(26).string(message.floor);
    }
    if (message.ceiling !== "") {
      writer.uint32(34).string(message.ceiling);
    }
    if (message.t !== 0) {
      writer.uint32(40).uint64(message.t);
    }
    if (message.graceDays !== 0) {
      writer.uint32(48).uint64(message.graceDays);
    }
    if (message.auctionDays !== 0) {
      writer.uint32(56).uint64(message.auctionDays);
    }
    if (message.transferFeeUlmn !== 0) {
      writer.uint32(96).uint64(message.transferFeeUlmn);
    }
    if (message.bidFeeUlmn !== 0) {
      writer.uint32(104).uint64(message.bidFeeUlmn);
    }
    if (message.updateRateLimitSeconds !== 0) {
      writer.uint32(112).uint64(message.updateRateLimitSeconds);
    }
    if (message.updatePowDifficulty !== 0) {
      writer.uint32(120).uint32(message.updatePowDifficulty);
    }
    for (const v of message.domainTiers) {
      LengthTier.encode(v, writer.uint32(130).fork()).join();
    }
    for (const v of message.extTiers) {
      LengthTier.encode(v, writer.uint32(138).fork()).join();
    }
    if (message.minPriceUlmnPerMonth !== 0) {
      writer.uint32(144).uint64(message.minPriceUlmnPerMonth);
    }
    if (message.updateFeeUlmn !== 0) {
      writer.uint32(152).uint64(message.updateFeeUlmn);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseParams();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.baseFeeDns = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.alpha = reader.string();
          continue;
        }
        case 3: {
          if (tag !== 26) {
            break;
          }
          message.floor = reader.string();
          continue;
        }
        case 4: {
          if (tag !== 34) {
            break;
          }
          message.ceiling = reader.string();
          continue;
        }
        case 5: {
          if (tag !== 40) {
            break;
          }
          message.t = longToNumber2(reader.uint64());
          continue;
        }
        case 6: {
          if (tag !== 48) {
            break;
          }
          message.graceDays = longToNumber2(reader.uint64());
          continue;
        }
        case 7: {
          if (tag !== 56) {
            break;
          }
          message.auctionDays = longToNumber2(reader.uint64());
          continue;
        }
        case 12: {
          if (tag !== 96) {
            break;
          }
          message.transferFeeUlmn = longToNumber2(reader.uint64());
          continue;
        }
        case 13: {
          if (tag !== 104) {
            break;
          }
          message.bidFeeUlmn = longToNumber2(reader.uint64());
          continue;
        }
        case 14: {
          if (tag !== 112) {
            break;
          }
          message.updateRateLimitSeconds = longToNumber2(reader.uint64());
          continue;
        }
        case 15: {
          if (tag !== 120) {
            break;
          }
          message.updatePowDifficulty = reader.uint32();
          continue;
        }
        case 16: {
          if (tag !== 130) {
            break;
          }
          message.domainTiers.push(LengthTier.decode(reader, reader.uint32()));
          continue;
        }
        case 17: {
          if (tag !== 138) {
            break;
          }
          message.extTiers.push(LengthTier.decode(reader, reader.uint32()));
          continue;
        }
        case 18: {
          if (tag !== 144) {
            break;
          }
          message.minPriceUlmnPerMonth = longToNumber2(reader.uint64());
          continue;
        }
        case 19: {
          if (tag !== 152) {
            break;
          }
          message.updateFeeUlmn = longToNumber2(reader.uint64());
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      baseFeeDns: isSet2(object.baseFeeDns) ? globalThis.String(object.baseFeeDns) : "",
      alpha: isSet2(object.alpha) ? globalThis.String(object.alpha) : "",
      floor: isSet2(object.floor) ? globalThis.String(object.floor) : "",
      ceiling: isSet2(object.ceiling) ? globalThis.String(object.ceiling) : "",
      t: isSet2(object.t) ? globalThis.Number(object.t) : 0,
      graceDays: isSet2(object.graceDays) ? globalThis.Number(object.graceDays) : 0,
      auctionDays: isSet2(object.auctionDays) ? globalThis.Number(object.auctionDays) : 0,
      transferFeeUlmn: isSet2(object.transferFeeUlmn) ? globalThis.Number(object.transferFeeUlmn) : 0,
      bidFeeUlmn: isSet2(object.bidFeeUlmn) ? globalThis.Number(object.bidFeeUlmn) : 0,
      updateRateLimitSeconds: isSet2(object.updateRateLimitSeconds) ? globalThis.Number(object.updateRateLimitSeconds) : 0,
      updatePowDifficulty: isSet2(object.updatePowDifficulty) ? globalThis.Number(object.updatePowDifficulty) : 0,
      domainTiers: globalThis.Array.isArray(object?.domainTiers) ? object.domainTiers.map((e) => LengthTier.fromJSON(e)) : [],
      extTiers: globalThis.Array.isArray(object?.extTiers) ? object.extTiers.map((e) => LengthTier.fromJSON(e)) : [],
      minPriceUlmnPerMonth: isSet2(object.minPriceUlmnPerMonth) ? globalThis.Number(object.minPriceUlmnPerMonth) : 0,
      updateFeeUlmn: isSet2(object.updateFeeUlmn) ? globalThis.Number(object.updateFeeUlmn) : 0
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.baseFeeDns !== "") {
      obj.baseFeeDns = message.baseFeeDns;
    }
    if (message.alpha !== "") {
      obj.alpha = message.alpha;
    }
    if (message.floor !== "") {
      obj.floor = message.floor;
    }
    if (message.ceiling !== "") {
      obj.ceiling = message.ceiling;
    }
    if (message.t !== 0) {
      obj.t = Math.round(message.t);
    }
    if (message.graceDays !== 0) {
      obj.graceDays = Math.round(message.graceDays);
    }
    if (message.auctionDays !== 0) {
      obj.auctionDays = Math.round(message.auctionDays);
    }
    if (message.transferFeeUlmn !== 0) {
      obj.transferFeeUlmn = Math.round(message.transferFeeUlmn);
    }
    if (message.bidFeeUlmn !== 0) {
      obj.bidFeeUlmn = Math.round(message.bidFeeUlmn);
    }
    if (message.updateRateLimitSeconds !== 0) {
      obj.updateRateLimitSeconds = Math.round(message.updateRateLimitSeconds);
    }
    if (message.updatePowDifficulty !== 0) {
      obj.updatePowDifficulty = Math.round(message.updatePowDifficulty);
    }
    if (message.domainTiers?.length) {
      obj.domainTiers = message.domainTiers.map((e) => LengthTier.toJSON(e));
    }
    if (message.extTiers?.length) {
      obj.extTiers = message.extTiers.map((e) => LengthTier.toJSON(e));
    }
    if (message.minPriceUlmnPerMonth !== 0) {
      obj.minPriceUlmnPerMonth = Math.round(message.minPriceUlmnPerMonth);
    }
    if (message.updateFeeUlmn !== 0) {
      obj.updateFeeUlmn = Math.round(message.updateFeeUlmn);
    }
    return obj;
  },
  create(base) {
    return Params.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseParams();
    message.baseFeeDns = object.baseFeeDns ?? "";
    message.alpha = object.alpha ?? "";
    message.floor = object.floor ?? "";
    message.ceiling = object.ceiling ?? "";
    message.t = object.t ?? 0;
    message.graceDays = object.graceDays ?? 0;
    message.auctionDays = object.auctionDays ?? 0;
    message.transferFeeUlmn = object.transferFeeUlmn ?? 0;
    message.bidFeeUlmn = object.bidFeeUlmn ?? 0;
    message.updateRateLimitSeconds = object.updateRateLimitSeconds ?? 0;
    message.updatePowDifficulty = object.updatePowDifficulty ?? 0;
    message.domainTiers = object.domainTiers?.map((e) => LengthTier.fromPartial(e)) || [];
    message.extTiers = object.extTiers?.map((e) => LengthTier.fromPartial(e)) || [];
    message.minPriceUlmnPerMonth = object.minPriceUlmnPerMonth ?? 0;
    message.updateFeeUlmn = object.updateFeeUlmn ?? 0;
    return message;
  }
};
function createBaseLengthTier() {
  return { maxLen: 0, multiplierBps: 0 };
}
var LengthTier = {
  encode(message, writer = new BinaryWriter()) {
    if (message.maxLen !== 0) {
      writer.uint32(8).uint32(message.maxLen);
    }
    if (message.multiplierBps !== 0) {
      writer.uint32(16).uint32(message.multiplierBps);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseLengthTier();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 8) {
            break;
          }
          message.maxLen = reader.uint32();
          continue;
        }
        case 2: {
          if (tag !== 16) {
            break;
          }
          message.multiplierBps = reader.uint32();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      maxLen: isSet2(object.maxLen) ? globalThis.Number(object.maxLen) : 0,
      multiplierBps: isSet2(object.multiplierBps) ? globalThis.Number(object.multiplierBps) : 0
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.maxLen !== 0) {
      obj.maxLen = Math.round(message.maxLen);
    }
    if (message.multiplierBps !== 0) {
      obj.multiplierBps = Math.round(message.multiplierBps);
    }
    return obj;
  },
  create(base) {
    return LengthTier.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseLengthTier();
    message.maxLen = object.maxLen ?? 0;
    message.multiplierBps = object.multiplierBps ?? 0;
    return message;
  }
};
function longToNumber2(int64) {
  const num = globalThis.Number(int64.toString());
  if (num > globalThis.Number.MAX_SAFE_INTEGER) {
    throw new globalThis.Error("Value is larger than Number.MAX_SAFE_INTEGER");
  }
  if (num < globalThis.Number.MIN_SAFE_INTEGER) {
    throw new globalThis.Error("Value is smaller than Number.MIN_SAFE_INTEGER");
  }
  return num;
}
function isSet2(value) {
  return value !== null && value !== void 0;
}

// src/types/lumen/dns/v1/tx.ts
function createBaseMsgUpdateParams() {
  return { authority: "", params: void 0 };
}
var MsgUpdateParams = {
  encode(message, writer = new BinaryWriter()) {
    if (message.authority !== "") {
      writer.uint32(10).string(message.authority);
    }
    if (message.params !== void 0) {
      Params.encode(message.params, writer.uint32(18).fork()).join();
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseMsgUpdateParams();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.authority = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.params = Params.decode(reader, reader.uint32());
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      authority: isSet3(object.authority) ? globalThis.String(object.authority) : "",
      params: isSet3(object.params) ? Params.fromJSON(object.params) : void 0
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.authority !== "") {
      obj.authority = message.authority;
    }
    if (message.params !== void 0) {
      obj.params = Params.toJSON(message.params);
    }
    return obj;
  },
  create(base) {
    return MsgUpdateParams.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseMsgUpdateParams();
    message.authority = object.authority ?? "";
    message.params = object.params !== void 0 && object.params !== null ? Params.fromPartial(object.params) : void 0;
    return message;
  }
};
function createBaseMsgRegister() {
  return { creator: "", domain: "", ext: "", records: [], durationDays: 0, owner: "" };
}
var MsgRegister = {
  encode(message, writer = new BinaryWriter()) {
    if (message.creator !== "") {
      writer.uint32(10).string(message.creator);
    }
    if (message.domain !== "") {
      writer.uint32(18).string(message.domain);
    }
    if (message.ext !== "") {
      writer.uint32(26).string(message.ext);
    }
    for (const v of message.records) {
      Record.encode(v, writer.uint32(50).fork()).join();
    }
    if (message.durationDays !== 0) {
      writer.uint32(56).uint64(message.durationDays);
    }
    if (message.owner !== "") {
      writer.uint32(74).string(message.owner);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseMsgRegister();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.creator = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.domain = reader.string();
          continue;
        }
        case 3: {
          if (tag !== 26) {
            break;
          }
          message.ext = reader.string();
          continue;
        }
        case 6: {
          if (tag !== 50) {
            break;
          }
          message.records.push(Record.decode(reader, reader.uint32()));
          continue;
        }
        case 7: {
          if (tag !== 56) {
            break;
          }
          message.durationDays = longToNumber3(reader.uint64());
          continue;
        }
        case 9: {
          if (tag !== 74) {
            break;
          }
          message.owner = reader.string();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      creator: isSet3(object.creator) ? globalThis.String(object.creator) : "",
      domain: isSet3(object.domain) ? globalThis.String(object.domain) : "",
      ext: isSet3(object.ext) ? globalThis.String(object.ext) : "",
      records: globalThis.Array.isArray(object?.records) ? object.records.map((e) => Record.fromJSON(e)) : [],
      durationDays: isSet3(object.durationDays) ? globalThis.Number(object.durationDays) : 0,
      owner: isSet3(object.owner) ? globalThis.String(object.owner) : ""
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.creator !== "") {
      obj.creator = message.creator;
    }
    if (message.domain !== "") {
      obj.domain = message.domain;
    }
    if (message.ext !== "") {
      obj.ext = message.ext;
    }
    if (message.records?.length) {
      obj.records = message.records.map((e) => Record.toJSON(e));
    }
    if (message.durationDays !== 0) {
      obj.durationDays = Math.round(message.durationDays);
    }
    if (message.owner !== "") {
      obj.owner = message.owner;
    }
    return obj;
  },
  create(base) {
    return MsgRegister.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseMsgRegister();
    message.creator = object.creator ?? "";
    message.domain = object.domain ?? "";
    message.ext = object.ext ?? "";
    message.records = object.records?.map((e) => Record.fromPartial(e)) || [];
    message.durationDays = object.durationDays ?? 0;
    message.owner = object.owner ?? "";
    return message;
  }
};
function createBaseMsgUpdate() {
  return { creator: "", domain: "", ext: "", records: [], powNonce: 0 };
}
var MsgUpdate = {
  encode(message, writer = new BinaryWriter()) {
    if (message.creator !== "") {
      writer.uint32(10).string(message.creator);
    }
    if (message.domain !== "") {
      writer.uint32(18).string(message.domain);
    }
    if (message.ext !== "") {
      writer.uint32(26).string(message.ext);
    }
    for (const v of message.records) {
      Record.encode(v, writer.uint32(50).fork()).join();
    }
    if (message.powNonce !== 0) {
      writer.uint32(56).uint64(message.powNonce);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseMsgUpdate();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.creator = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.domain = reader.string();
          continue;
        }
        case 3: {
          if (tag !== 26) {
            break;
          }
          message.ext = reader.string();
          continue;
        }
        case 6: {
          if (tag !== 50) {
            break;
          }
          message.records.push(Record.decode(reader, reader.uint32()));
          continue;
        }
        case 7: {
          if (tag !== 56) {
            break;
          }
          message.powNonce = longToNumber3(reader.uint64());
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      creator: isSet3(object.creator) ? globalThis.String(object.creator) : "",
      domain: isSet3(object.domain) ? globalThis.String(object.domain) : "",
      ext: isSet3(object.ext) ? globalThis.String(object.ext) : "",
      records: globalThis.Array.isArray(object?.records) ? object.records.map((e) => Record.fromJSON(e)) : [],
      powNonce: isSet3(object.powNonce) ? globalThis.Number(object.powNonce) : 0
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.creator !== "") {
      obj.creator = message.creator;
    }
    if (message.domain !== "") {
      obj.domain = message.domain;
    }
    if (message.ext !== "") {
      obj.ext = message.ext;
    }
    if (message.records?.length) {
      obj.records = message.records.map((e) => Record.toJSON(e));
    }
    if (message.powNonce !== 0) {
      obj.powNonce = Math.round(message.powNonce);
    }
    return obj;
  },
  create(base) {
    return MsgUpdate.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseMsgUpdate();
    message.creator = object.creator ?? "";
    message.domain = object.domain ?? "";
    message.ext = object.ext ?? "";
    message.records = object.records?.map((e) => Record.fromPartial(e)) || [];
    message.powNonce = object.powNonce ?? 0;
    return message;
  }
};
function createBaseMsgRenew() {
  return { creator: "", domain: "", ext: "", durationDays: 0 };
}
var MsgRenew = {
  encode(message, writer = new BinaryWriter()) {
    if (message.creator !== "") {
      writer.uint32(10).string(message.creator);
    }
    if (message.domain !== "") {
      writer.uint32(18).string(message.domain);
    }
    if (message.ext !== "") {
      writer.uint32(26).string(message.ext);
    }
    if (message.durationDays !== 0) {
      writer.uint32(32).uint64(message.durationDays);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseMsgRenew();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.creator = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.domain = reader.string();
          continue;
        }
        case 3: {
          if (tag !== 26) {
            break;
          }
          message.ext = reader.string();
          continue;
        }
        case 4: {
          if (tag !== 32) {
            break;
          }
          message.durationDays = longToNumber3(reader.uint64());
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      creator: isSet3(object.creator) ? globalThis.String(object.creator) : "",
      domain: isSet3(object.domain) ? globalThis.String(object.domain) : "",
      ext: isSet3(object.ext) ? globalThis.String(object.ext) : "",
      durationDays: isSet3(object.durationDays) ? globalThis.Number(object.durationDays) : 0
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.creator !== "") {
      obj.creator = message.creator;
    }
    if (message.domain !== "") {
      obj.domain = message.domain;
    }
    if (message.ext !== "") {
      obj.ext = message.ext;
    }
    if (message.durationDays !== 0) {
      obj.durationDays = Math.round(message.durationDays);
    }
    return obj;
  },
  create(base) {
    return MsgRenew.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseMsgRenew();
    message.creator = object.creator ?? "";
    message.domain = object.domain ?? "";
    message.ext = object.ext ?? "";
    message.durationDays = object.durationDays ?? 0;
    return message;
  }
};
function createBaseMsgTransfer() {
  return { creator: "", domain: "", ext: "", newOwner: "" };
}
var MsgTransfer = {
  encode(message, writer = new BinaryWriter()) {
    if (message.creator !== "") {
      writer.uint32(10).string(message.creator);
    }
    if (message.domain !== "") {
      writer.uint32(18).string(message.domain);
    }
    if (message.ext !== "") {
      writer.uint32(26).string(message.ext);
    }
    if (message.newOwner !== "") {
      writer.uint32(34).string(message.newOwner);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseMsgTransfer();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.creator = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.domain = reader.string();
          continue;
        }
        case 3: {
          if (tag !== 26) {
            break;
          }
          message.ext = reader.string();
          continue;
        }
        case 4: {
          if (tag !== 34) {
            break;
          }
          message.newOwner = reader.string();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      creator: isSet3(object.creator) ? globalThis.String(object.creator) : "",
      domain: isSet3(object.domain) ? globalThis.String(object.domain) : "",
      ext: isSet3(object.ext) ? globalThis.String(object.ext) : "",
      newOwner: isSet3(object.newOwner) ? globalThis.String(object.newOwner) : ""
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.creator !== "") {
      obj.creator = message.creator;
    }
    if (message.domain !== "") {
      obj.domain = message.domain;
    }
    if (message.ext !== "") {
      obj.ext = message.ext;
    }
    if (message.newOwner !== "") {
      obj.newOwner = message.newOwner;
    }
    return obj;
  },
  create(base) {
    return MsgTransfer.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseMsgTransfer();
    message.creator = object.creator ?? "";
    message.domain = object.domain ?? "";
    message.ext = object.ext ?? "";
    message.newOwner = object.newOwner ?? "";
    return message;
  }
};
function createBaseMsgBid() {
  return { creator: "", domain: "", ext: "", amount: "" };
}
var MsgBid = {
  encode(message, writer = new BinaryWriter()) {
    if (message.creator !== "") {
      writer.uint32(10).string(message.creator);
    }
    if (message.domain !== "") {
      writer.uint32(18).string(message.domain);
    }
    if (message.ext !== "") {
      writer.uint32(26).string(message.ext);
    }
    if (message.amount !== "") {
      writer.uint32(34).string(message.amount);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseMsgBid();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.creator = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.domain = reader.string();
          continue;
        }
        case 3: {
          if (tag !== 26) {
            break;
          }
          message.ext = reader.string();
          continue;
        }
        case 4: {
          if (tag !== 34) {
            break;
          }
          message.amount = reader.string();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      creator: isSet3(object.creator) ? globalThis.String(object.creator) : "",
      domain: isSet3(object.domain) ? globalThis.String(object.domain) : "",
      ext: isSet3(object.ext) ? globalThis.String(object.ext) : "",
      amount: isSet3(object.amount) ? globalThis.String(object.amount) : ""
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.creator !== "") {
      obj.creator = message.creator;
    }
    if (message.domain !== "") {
      obj.domain = message.domain;
    }
    if (message.ext !== "") {
      obj.ext = message.ext;
    }
    if (message.amount !== "") {
      obj.amount = message.amount;
    }
    return obj;
  },
  create(base) {
    return MsgBid.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseMsgBid();
    message.creator = object.creator ?? "";
    message.domain = object.domain ?? "";
    message.ext = object.ext ?? "";
    message.amount = object.amount ?? "";
    return message;
  }
};
function createBaseMsgCreateDomain() {
  return { creator: "", index: "", name: "", owner: "", records: [], expireAt: 0 };
}
var MsgCreateDomain = {
  encode(message, writer = new BinaryWriter()) {
    if (message.creator !== "") {
      writer.uint32(10).string(message.creator);
    }
    if (message.index !== "") {
      writer.uint32(18).string(message.index);
    }
    if (message.name !== "") {
      writer.uint32(26).string(message.name);
    }
    if (message.owner !== "") {
      writer.uint32(34).string(message.owner);
    }
    for (const v of message.records) {
      Record.encode(v, writer.uint32(42).fork()).join();
    }
    if (message.expireAt !== 0) {
      writer.uint32(48).uint64(message.expireAt);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseMsgCreateDomain();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.creator = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.index = reader.string();
          continue;
        }
        case 3: {
          if (tag !== 26) {
            break;
          }
          message.name = reader.string();
          continue;
        }
        case 4: {
          if (tag !== 34) {
            break;
          }
          message.owner = reader.string();
          continue;
        }
        case 5: {
          if (tag !== 42) {
            break;
          }
          message.records.push(Record.decode(reader, reader.uint32()));
          continue;
        }
        case 6: {
          if (tag !== 48) {
            break;
          }
          message.expireAt = longToNumber3(reader.uint64());
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      creator: isSet3(object.creator) ? globalThis.String(object.creator) : "",
      index: isSet3(object.index) ? globalThis.String(object.index) : "",
      name: isSet3(object.name) ? globalThis.String(object.name) : "",
      owner: isSet3(object.owner) ? globalThis.String(object.owner) : "",
      records: globalThis.Array.isArray(object?.records) ? object.records.map((e) => Record.fromJSON(e)) : [],
      expireAt: isSet3(object.expireAt) ? globalThis.Number(object.expireAt) : 0
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.creator !== "") {
      obj.creator = message.creator;
    }
    if (message.index !== "") {
      obj.index = message.index;
    }
    if (message.name !== "") {
      obj.name = message.name;
    }
    if (message.owner !== "") {
      obj.owner = message.owner;
    }
    if (message.records?.length) {
      obj.records = message.records.map((e) => Record.toJSON(e));
    }
    if (message.expireAt !== 0) {
      obj.expireAt = Math.round(message.expireAt);
    }
    return obj;
  },
  create(base) {
    return MsgCreateDomain.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseMsgCreateDomain();
    message.creator = object.creator ?? "";
    message.index = object.index ?? "";
    message.name = object.name ?? "";
    message.owner = object.owner ?? "";
    message.records = object.records?.map((e) => Record.fromPartial(e)) || [];
    message.expireAt = object.expireAt ?? 0;
    return message;
  }
};
function createBaseMsgUpdateDomain() {
  return { creator: "", index: "", name: "", owner: "", records: [], expireAt: 0, powNonce: 0 };
}
var MsgUpdateDomain = {
  encode(message, writer = new BinaryWriter()) {
    if (message.creator !== "") {
      writer.uint32(10).string(message.creator);
    }
    if (message.index !== "") {
      writer.uint32(18).string(message.index);
    }
    if (message.name !== "") {
      writer.uint32(26).string(message.name);
    }
    if (message.owner !== "") {
      writer.uint32(34).string(message.owner);
    }
    for (const v of message.records) {
      Record.encode(v, writer.uint32(42).fork()).join();
    }
    if (message.expireAt !== 0) {
      writer.uint32(48).uint64(message.expireAt);
    }
    if (message.powNonce !== 0) {
      writer.uint32(56).uint64(message.powNonce);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseMsgUpdateDomain();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.creator = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.index = reader.string();
          continue;
        }
        case 3: {
          if (tag !== 26) {
            break;
          }
          message.name = reader.string();
          continue;
        }
        case 4: {
          if (tag !== 34) {
            break;
          }
          message.owner = reader.string();
          continue;
        }
        case 5: {
          if (tag !== 42) {
            break;
          }
          message.records.push(Record.decode(reader, reader.uint32()));
          continue;
        }
        case 6: {
          if (tag !== 48) {
            break;
          }
          message.expireAt = longToNumber3(reader.uint64());
          continue;
        }
        case 7: {
          if (tag !== 56) {
            break;
          }
          message.powNonce = longToNumber3(reader.uint64());
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      creator: isSet3(object.creator) ? globalThis.String(object.creator) : "",
      index: isSet3(object.index) ? globalThis.String(object.index) : "",
      name: isSet3(object.name) ? globalThis.String(object.name) : "",
      owner: isSet3(object.owner) ? globalThis.String(object.owner) : "",
      records: globalThis.Array.isArray(object?.records) ? object.records.map((e) => Record.fromJSON(e)) : [],
      expireAt: isSet3(object.expireAt) ? globalThis.Number(object.expireAt) : 0,
      powNonce: isSet3(object.powNonce) ? globalThis.Number(object.powNonce) : 0
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.creator !== "") {
      obj.creator = message.creator;
    }
    if (message.index !== "") {
      obj.index = message.index;
    }
    if (message.name !== "") {
      obj.name = message.name;
    }
    if (message.owner !== "") {
      obj.owner = message.owner;
    }
    if (message.records?.length) {
      obj.records = message.records.map((e) => Record.toJSON(e));
    }
    if (message.expireAt !== 0) {
      obj.expireAt = Math.round(message.expireAt);
    }
    if (message.powNonce !== 0) {
      obj.powNonce = Math.round(message.powNonce);
    }
    return obj;
  },
  create(base) {
    return MsgUpdateDomain.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseMsgUpdateDomain();
    message.creator = object.creator ?? "";
    message.index = object.index ?? "";
    message.name = object.name ?? "";
    message.owner = object.owner ?? "";
    message.records = object.records?.map((e) => Record.fromPartial(e)) || [];
    message.expireAt = object.expireAt ?? 0;
    message.powNonce = object.powNonce ?? 0;
    return message;
  }
};
function createBaseMsgDeleteDomain() {
  return { creator: "", index: "" };
}
var MsgDeleteDomain = {
  encode(message, writer = new BinaryWriter()) {
    if (message.creator !== "") {
      writer.uint32(10).string(message.creator);
    }
    if (message.index !== "") {
      writer.uint32(18).string(message.index);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseMsgDeleteDomain();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.creator = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.index = reader.string();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      creator: isSet3(object.creator) ? globalThis.String(object.creator) : "",
      index: isSet3(object.index) ? globalThis.String(object.index) : ""
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.creator !== "") {
      obj.creator = message.creator;
    }
    if (message.index !== "") {
      obj.index = message.index;
    }
    return obj;
  },
  create(base) {
    return MsgDeleteDomain.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseMsgDeleteDomain();
    message.creator = object.creator ?? "";
    message.index = object.index ?? "";
    return message;
  }
};
function createBaseMsgCreateAuction() {
  return { creator: "", index: "", name: "", start: 0, end: 0, highestBid: "", bidder: "" };
}
var MsgCreateAuction = {
  encode(message, writer = new BinaryWriter()) {
    if (message.creator !== "") {
      writer.uint32(10).string(message.creator);
    }
    if (message.index !== "") {
      writer.uint32(18).string(message.index);
    }
    if (message.name !== "") {
      writer.uint32(26).string(message.name);
    }
    if (message.start !== 0) {
      writer.uint32(32).uint64(message.start);
    }
    if (message.end !== 0) {
      writer.uint32(40).uint64(message.end);
    }
    if (message.highestBid !== "") {
      writer.uint32(50).string(message.highestBid);
    }
    if (message.bidder !== "") {
      writer.uint32(58).string(message.bidder);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseMsgCreateAuction();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.creator = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.index = reader.string();
          continue;
        }
        case 3: {
          if (tag !== 26) {
            break;
          }
          message.name = reader.string();
          continue;
        }
        case 4: {
          if (tag !== 32) {
            break;
          }
          message.start = longToNumber3(reader.uint64());
          continue;
        }
        case 5: {
          if (tag !== 40) {
            break;
          }
          message.end = longToNumber3(reader.uint64());
          continue;
        }
        case 6: {
          if (tag !== 50) {
            break;
          }
          message.highestBid = reader.string();
          continue;
        }
        case 7: {
          if (tag !== 58) {
            break;
          }
          message.bidder = reader.string();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      creator: isSet3(object.creator) ? globalThis.String(object.creator) : "",
      index: isSet3(object.index) ? globalThis.String(object.index) : "",
      name: isSet3(object.name) ? globalThis.String(object.name) : "",
      start: isSet3(object.start) ? globalThis.Number(object.start) : 0,
      end: isSet3(object.end) ? globalThis.Number(object.end) : 0,
      highestBid: isSet3(object.highestBid) ? globalThis.String(object.highestBid) : "",
      bidder: isSet3(object.bidder) ? globalThis.String(object.bidder) : ""
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.creator !== "") {
      obj.creator = message.creator;
    }
    if (message.index !== "") {
      obj.index = message.index;
    }
    if (message.name !== "") {
      obj.name = message.name;
    }
    if (message.start !== 0) {
      obj.start = Math.round(message.start);
    }
    if (message.end !== 0) {
      obj.end = Math.round(message.end);
    }
    if (message.highestBid !== "") {
      obj.highestBid = message.highestBid;
    }
    if (message.bidder !== "") {
      obj.bidder = message.bidder;
    }
    return obj;
  },
  create(base) {
    return MsgCreateAuction.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseMsgCreateAuction();
    message.creator = object.creator ?? "";
    message.index = object.index ?? "";
    message.name = object.name ?? "";
    message.start = object.start ?? 0;
    message.end = object.end ?? 0;
    message.highestBid = object.highestBid ?? "";
    message.bidder = object.bidder ?? "";
    return message;
  }
};
function createBaseMsgUpdateAuction() {
  return { creator: "", index: "", name: "", start: 0, end: 0, highestBid: "", bidder: "" };
}
var MsgUpdateAuction = {
  encode(message, writer = new BinaryWriter()) {
    if (message.creator !== "") {
      writer.uint32(10).string(message.creator);
    }
    if (message.index !== "") {
      writer.uint32(18).string(message.index);
    }
    if (message.name !== "") {
      writer.uint32(26).string(message.name);
    }
    if (message.start !== 0) {
      writer.uint32(32).uint64(message.start);
    }
    if (message.end !== 0) {
      writer.uint32(40).uint64(message.end);
    }
    if (message.highestBid !== "") {
      writer.uint32(50).string(message.highestBid);
    }
    if (message.bidder !== "") {
      writer.uint32(58).string(message.bidder);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseMsgUpdateAuction();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.creator = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.index = reader.string();
          continue;
        }
        case 3: {
          if (tag !== 26) {
            break;
          }
          message.name = reader.string();
          continue;
        }
        case 4: {
          if (tag !== 32) {
            break;
          }
          message.start = longToNumber3(reader.uint64());
          continue;
        }
        case 5: {
          if (tag !== 40) {
            break;
          }
          message.end = longToNumber3(reader.uint64());
          continue;
        }
        case 6: {
          if (tag !== 50) {
            break;
          }
          message.highestBid = reader.string();
          continue;
        }
        case 7: {
          if (tag !== 58) {
            break;
          }
          message.bidder = reader.string();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      creator: isSet3(object.creator) ? globalThis.String(object.creator) : "",
      index: isSet3(object.index) ? globalThis.String(object.index) : "",
      name: isSet3(object.name) ? globalThis.String(object.name) : "",
      start: isSet3(object.start) ? globalThis.Number(object.start) : 0,
      end: isSet3(object.end) ? globalThis.Number(object.end) : 0,
      highestBid: isSet3(object.highestBid) ? globalThis.String(object.highestBid) : "",
      bidder: isSet3(object.bidder) ? globalThis.String(object.bidder) : ""
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.creator !== "") {
      obj.creator = message.creator;
    }
    if (message.index !== "") {
      obj.index = message.index;
    }
    if (message.name !== "") {
      obj.name = message.name;
    }
    if (message.start !== 0) {
      obj.start = Math.round(message.start);
    }
    if (message.end !== 0) {
      obj.end = Math.round(message.end);
    }
    if (message.highestBid !== "") {
      obj.highestBid = message.highestBid;
    }
    if (message.bidder !== "") {
      obj.bidder = message.bidder;
    }
    return obj;
  },
  create(base) {
    return MsgUpdateAuction.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseMsgUpdateAuction();
    message.creator = object.creator ?? "";
    message.index = object.index ?? "";
    message.name = object.name ?? "";
    message.start = object.start ?? 0;
    message.end = object.end ?? 0;
    message.highestBid = object.highestBid ?? "";
    message.bidder = object.bidder ?? "";
    return message;
  }
};
function createBaseMsgDeleteAuction() {
  return { creator: "", index: "" };
}
var MsgDeleteAuction = {
  encode(message, writer = new BinaryWriter()) {
    if (message.creator !== "") {
      writer.uint32(10).string(message.creator);
    }
    if (message.index !== "") {
      writer.uint32(18).string(message.index);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseMsgDeleteAuction();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.creator = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.index = reader.string();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      creator: isSet3(object.creator) ? globalThis.String(object.creator) : "",
      index: isSet3(object.index) ? globalThis.String(object.index) : ""
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.creator !== "") {
      obj.creator = message.creator;
    }
    if (message.index !== "") {
      obj.index = message.index;
    }
    return obj;
  },
  create(base) {
    return MsgDeleteAuction.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseMsgDeleteAuction();
    message.creator = object.creator ?? "";
    message.index = object.index ?? "";
    return message;
  }
};
function createBaseMsgSettle() {
  return { creator: "", domain: "", ext: "" };
}
var MsgSettle = {
  encode(message, writer = new BinaryWriter()) {
    if (message.creator !== "") {
      writer.uint32(10).string(message.creator);
    }
    if (message.domain !== "") {
      writer.uint32(18).string(message.domain);
    }
    if (message.ext !== "") {
      writer.uint32(26).string(message.ext);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseMsgSettle();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.creator = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.domain = reader.string();
          continue;
        }
        case 3: {
          if (tag !== 26) {
            break;
          }
          message.ext = reader.string();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      creator: isSet3(object.creator) ? globalThis.String(object.creator) : "",
      domain: isSet3(object.domain) ? globalThis.String(object.domain) : "",
      ext: isSet3(object.ext) ? globalThis.String(object.ext) : ""
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.creator !== "") {
      obj.creator = message.creator;
    }
    if (message.domain !== "") {
      obj.domain = message.domain;
    }
    if (message.ext !== "") {
      obj.ext = message.ext;
    }
    return obj;
  },
  create(base) {
    return MsgSettle.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseMsgSettle();
    message.creator = object.creator ?? "";
    message.domain = object.domain ?? "";
    message.ext = object.ext ?? "";
    return message;
  }
};
function longToNumber3(int64) {
  const num = globalThis.Number(int64.toString());
  if (num > globalThis.Number.MAX_SAFE_INTEGER) {
    throw new globalThis.Error("Value is larger than Number.MAX_SAFE_INTEGER");
  }
  if (num < globalThis.Number.MIN_SAFE_INTEGER) {
    throw new globalThis.Error("Value is smaller than Number.MIN_SAFE_INTEGER");
  }
  return num;
}
function isSet3(value) {
  return value !== null && value !== void 0;
}
function createBaseBoolValue() {
  return { value: false };
}
var BoolValue = {
  encode(message, writer = new BinaryWriter()) {
    if (message.value !== false) {
      writer.uint32(8).bool(message.value);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseBoolValue();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 8) {
            break;
          }
          message.value = reader.bool();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return { value: isSet4(object.value) ? globalThis.Boolean(object.value) : false };
  },
  toJSON(message) {
    const obj = {};
    if (message.value !== false) {
      obj.value = message.value;
    }
    return obj;
  },
  create(base) {
    return BoolValue.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseBoolValue();
    message.value = object.value ?? false;
    return message;
  }
};
function createBaseStringValue() {
  return { value: "" };
}
var StringValue = {
  encode(message, writer = new BinaryWriter()) {
    if (message.value !== "") {
      writer.uint32(10).string(message.value);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseStringValue();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.value = reader.string();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return { value: isSet4(object.value) ? globalThis.String(object.value) : "" };
  },
  toJSON(message) {
    const obj = {};
    if (message.value !== "") {
      obj.value = message.value;
    }
    return obj;
  },
  create(base) {
    return StringValue.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseStringValue();
    message.value = object.value ?? "";
    return message;
  }
};
function isSet4(value) {
  return value !== null && value !== void 0;
}
function createBaseParams2() {
  return {
    platformCommissionBps: 0,
    monthSeconds: 0,
    finalizeDelayMonths: 0,
    finalizerRewardBps: 0,
    minPriceUlmnPerMonth: 0,
    maxActiveContractsPerGateway: 0,
    actionFeeUlmn: 0,
    registerGatewayFeeUlmn: 0
  };
}
var Params2 = {
  encode(message, writer = new BinaryWriter()) {
    if (message.platformCommissionBps !== 0) {
      writer.uint32(8).uint32(message.platformCommissionBps);
    }
    if (message.monthSeconds !== 0) {
      writer.uint32(16).uint64(message.monthSeconds);
    }
    if (message.finalizeDelayMonths !== 0) {
      writer.uint32(24).uint32(message.finalizeDelayMonths);
    }
    if (message.finalizerRewardBps !== 0) {
      writer.uint32(32).uint32(message.finalizerRewardBps);
    }
    if (message.minPriceUlmnPerMonth !== 0) {
      writer.uint32(40).uint64(message.minPriceUlmnPerMonth);
    }
    if (message.maxActiveContractsPerGateway !== 0) {
      writer.uint32(48).uint32(message.maxActiveContractsPerGateway);
    }
    if (message.actionFeeUlmn !== 0) {
      writer.uint32(56).uint64(message.actionFeeUlmn);
    }
    if (message.registerGatewayFeeUlmn !== 0) {
      writer.uint32(64).uint64(message.registerGatewayFeeUlmn);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseParams2();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 8) {
            break;
          }
          message.platformCommissionBps = reader.uint32();
          continue;
        }
        case 2: {
          if (tag !== 16) {
            break;
          }
          message.monthSeconds = longToNumber4(reader.uint64());
          continue;
        }
        case 3: {
          if (tag !== 24) {
            break;
          }
          message.finalizeDelayMonths = reader.uint32();
          continue;
        }
        case 4: {
          if (tag !== 32) {
            break;
          }
          message.finalizerRewardBps = reader.uint32();
          continue;
        }
        case 5: {
          if (tag !== 40) {
            break;
          }
          message.minPriceUlmnPerMonth = longToNumber4(reader.uint64());
          continue;
        }
        case 6: {
          if (tag !== 48) {
            break;
          }
          message.maxActiveContractsPerGateway = reader.uint32();
          continue;
        }
        case 7: {
          if (tag !== 56) {
            break;
          }
          message.actionFeeUlmn = longToNumber4(reader.uint64());
          continue;
        }
        case 8: {
          if (tag !== 64) {
            break;
          }
          message.registerGatewayFeeUlmn = longToNumber4(reader.uint64());
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      platformCommissionBps: isSet5(object.platformCommissionBps) ? globalThis.Number(object.platformCommissionBps) : 0,
      monthSeconds: isSet5(object.monthSeconds) ? globalThis.Number(object.monthSeconds) : 0,
      finalizeDelayMonths: isSet5(object.finalizeDelayMonths) ? globalThis.Number(object.finalizeDelayMonths) : 0,
      finalizerRewardBps: isSet5(object.finalizerRewardBps) ? globalThis.Number(object.finalizerRewardBps) : 0,
      minPriceUlmnPerMonth: isSet5(object.minPriceUlmnPerMonth) ? globalThis.Number(object.minPriceUlmnPerMonth) : 0,
      maxActiveContractsPerGateway: isSet5(object.maxActiveContractsPerGateway) ? globalThis.Number(object.maxActiveContractsPerGateway) : 0,
      actionFeeUlmn: isSet5(object.actionFeeUlmn) ? globalThis.Number(object.actionFeeUlmn) : 0,
      registerGatewayFeeUlmn: isSet5(object.registerGatewayFeeUlmn) ? globalThis.Number(object.registerGatewayFeeUlmn) : 0
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.platformCommissionBps !== 0) {
      obj.platformCommissionBps = Math.round(message.platformCommissionBps);
    }
    if (message.monthSeconds !== 0) {
      obj.monthSeconds = Math.round(message.monthSeconds);
    }
    if (message.finalizeDelayMonths !== 0) {
      obj.finalizeDelayMonths = Math.round(message.finalizeDelayMonths);
    }
    if (message.finalizerRewardBps !== 0) {
      obj.finalizerRewardBps = Math.round(message.finalizerRewardBps);
    }
    if (message.minPriceUlmnPerMonth !== 0) {
      obj.minPriceUlmnPerMonth = Math.round(message.minPriceUlmnPerMonth);
    }
    if (message.maxActiveContractsPerGateway !== 0) {
      obj.maxActiveContractsPerGateway = Math.round(message.maxActiveContractsPerGateway);
    }
    if (message.actionFeeUlmn !== 0) {
      obj.actionFeeUlmn = Math.round(message.actionFeeUlmn);
    }
    if (message.registerGatewayFeeUlmn !== 0) {
      obj.registerGatewayFeeUlmn = Math.round(message.registerGatewayFeeUlmn);
    }
    return obj;
  },
  create(base) {
    return Params2.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseParams2();
    message.platformCommissionBps = object.platformCommissionBps ?? 0;
    message.monthSeconds = object.monthSeconds ?? 0;
    message.finalizeDelayMonths = object.finalizeDelayMonths ?? 0;
    message.finalizerRewardBps = object.finalizerRewardBps ?? 0;
    message.minPriceUlmnPerMonth = object.minPriceUlmnPerMonth ?? 0;
    message.maxActiveContractsPerGateway = object.maxActiveContractsPerGateway ?? 0;
    message.actionFeeUlmn = object.actionFeeUlmn ?? 0;
    message.registerGatewayFeeUlmn = object.registerGatewayFeeUlmn ?? 0;
    return message;
  }
};
function longToNumber4(int64) {
  const num = globalThis.Number(int64.toString());
  if (num > globalThis.Number.MAX_SAFE_INTEGER) {
    throw new globalThis.Error("Value is larger than Number.MAX_SAFE_INTEGER");
  }
  if (num < globalThis.Number.MIN_SAFE_INTEGER) {
    throw new globalThis.Error("Value is smaller than Number.MIN_SAFE_INTEGER");
  }
  return num;
}
function isSet5(value) {
  return value !== null && value !== void 0;
}

// src/types/lumen/gateway/v1/tx.ts
function createBaseMsgRegisterGateway() {
  return { operator: "", payout: "", metadata: "" };
}
var MsgRegisterGateway = {
  encode(message, writer = new BinaryWriter()) {
    if (message.operator !== "") {
      writer.uint32(10).string(message.operator);
    }
    if (message.payout !== "") {
      writer.uint32(18).string(message.payout);
    }
    if (message.metadata !== "") {
      writer.uint32(26).string(message.metadata);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseMsgRegisterGateway();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.operator = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.payout = reader.string();
          continue;
        }
        case 3: {
          if (tag !== 26) {
            break;
          }
          message.metadata = reader.string();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      operator: isSet6(object.operator) ? globalThis.String(object.operator) : "",
      payout: isSet6(object.payout) ? globalThis.String(object.payout) : "",
      metadata: isSet6(object.metadata) ? globalThis.String(object.metadata) : ""
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.operator !== "") {
      obj.operator = message.operator;
    }
    if (message.payout !== "") {
      obj.payout = message.payout;
    }
    if (message.metadata !== "") {
      obj.metadata = message.metadata;
    }
    return obj;
  },
  create(base) {
    return MsgRegisterGateway.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseMsgRegisterGateway();
    message.operator = object.operator ?? "";
    message.payout = object.payout ?? "";
    message.metadata = object.metadata ?? "";
    return message;
  }
};
function createBaseMsgUpdateGateway() {
  return { operator: "", gatewayId: 0, payout: void 0, metadata: void 0, active: void 0 };
}
var MsgUpdateGateway = {
  encode(message, writer = new BinaryWriter()) {
    if (message.operator !== "") {
      writer.uint32(10).string(message.operator);
    }
    if (message.gatewayId !== 0) {
      writer.uint32(16).uint64(message.gatewayId);
    }
    if (message.payout !== void 0) {
      StringValue.encode({ value: message.payout }, writer.uint32(26).fork()).join();
    }
    if (message.metadata !== void 0) {
      StringValue.encode({ value: message.metadata }, writer.uint32(34).fork()).join();
    }
    if (message.active !== void 0) {
      BoolValue.encode({ value: message.active }, writer.uint32(42).fork()).join();
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseMsgUpdateGateway();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.operator = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 16) {
            break;
          }
          message.gatewayId = longToNumber5(reader.uint64());
          continue;
        }
        case 3: {
          if (tag !== 26) {
            break;
          }
          message.payout = StringValue.decode(reader, reader.uint32()).value;
          continue;
        }
        case 4: {
          if (tag !== 34) {
            break;
          }
          message.metadata = StringValue.decode(reader, reader.uint32()).value;
          continue;
        }
        case 5: {
          if (tag !== 42) {
            break;
          }
          message.active = BoolValue.decode(reader, reader.uint32()).value;
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      operator: isSet6(object.operator) ? globalThis.String(object.operator) : "",
      gatewayId: isSet6(object.gatewayId) ? globalThis.Number(object.gatewayId) : 0,
      payout: isSet6(object.payout) ? String(object.payout) : void 0,
      metadata: isSet6(object.metadata) ? String(object.metadata) : void 0,
      active: isSet6(object.active) ? Boolean(object.active) : void 0
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.operator !== "") {
      obj.operator = message.operator;
    }
    if (message.gatewayId !== 0) {
      obj.gatewayId = Math.round(message.gatewayId);
    }
    if (message.payout !== void 0) {
      obj.payout = message.payout;
    }
    if (message.metadata !== void 0) {
      obj.metadata = message.metadata;
    }
    if (message.active !== void 0) {
      obj.active = message.active;
    }
    return obj;
  },
  create(base) {
    return MsgUpdateGateway.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseMsgUpdateGateway();
    message.operator = object.operator ?? "";
    message.gatewayId = object.gatewayId ?? 0;
    message.payout = object.payout ?? void 0;
    message.metadata = object.metadata ?? void 0;
    message.active = object.active ?? void 0;
    return message;
  }
};
function createBaseMsgUpdateParams2() {
  return { authority: "", params: void 0 };
}
var MsgUpdateParams2 = {
  encode(message, writer = new BinaryWriter()) {
    if (message.authority !== "") {
      writer.uint32(10).string(message.authority);
    }
    if (message.params !== void 0) {
      Params2.encode(message.params, writer.uint32(18).fork()).join();
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseMsgUpdateParams2();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.authority = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.params = Params2.decode(reader, reader.uint32());
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      authority: isSet6(object.authority) ? globalThis.String(object.authority) : "",
      params: isSet6(object.params) ? Params2.fromJSON(object.params) : void 0
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.authority !== "") {
      obj.authority = message.authority;
    }
    if (message.params !== void 0) {
      obj.params = Params2.toJSON(message.params);
    }
    return obj;
  },
  create(base) {
    return MsgUpdateParams2.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseMsgUpdateParams2();
    message.authority = object.authority ?? "";
    message.params = object.params !== void 0 && object.params !== null ? Params2.fromPartial(object.params) : void 0;
    return message;
  }
};
function createBaseMsgCreateContract() {
  return {
    client: "",
    gatewayId: 0,
    priceUlmn: 0,
    storageGbPerMonth: 0,
    networkGbPerMonth: 0,
    monthsTotal: 0,
    metadata: ""
  };
}
var MsgCreateContract = {
  encode(message, writer = new BinaryWriter()) {
    if (message.client !== "") {
      writer.uint32(10).string(message.client);
    }
    if (message.gatewayId !== 0) {
      writer.uint32(16).uint64(message.gatewayId);
    }
    if (message.priceUlmn !== 0) {
      writer.uint32(24).uint64(message.priceUlmn);
    }
    if (message.storageGbPerMonth !== 0) {
      writer.uint32(32).uint64(message.storageGbPerMonth);
    }
    if (message.networkGbPerMonth !== 0) {
      writer.uint32(40).uint64(message.networkGbPerMonth);
    }
    if (message.monthsTotal !== 0) {
      writer.uint32(48).uint32(message.monthsTotal);
    }
    if (message.metadata !== "") {
      writer.uint32(58).string(message.metadata);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseMsgCreateContract();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.client = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 16) {
            break;
          }
          message.gatewayId = longToNumber5(reader.uint64());
          continue;
        }
        case 3: {
          if (tag !== 24) {
            break;
          }
          message.priceUlmn = longToNumber5(reader.uint64());
          continue;
        }
        case 4: {
          if (tag !== 32) {
            break;
          }
          message.storageGbPerMonth = longToNumber5(reader.uint64());
          continue;
        }
        case 5: {
          if (tag !== 40) {
            break;
          }
          message.networkGbPerMonth = longToNumber5(reader.uint64());
          continue;
        }
        case 6: {
          if (tag !== 48) {
            break;
          }
          message.monthsTotal = reader.uint32();
          continue;
        }
        case 7: {
          if (tag !== 58) {
            break;
          }
          message.metadata = reader.string();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      client: isSet6(object.client) ? globalThis.String(object.client) : "",
      gatewayId: isSet6(object.gatewayId) ? globalThis.Number(object.gatewayId) : 0,
      priceUlmn: isSet6(object.priceUlmn) ? globalThis.Number(object.priceUlmn) : 0,
      storageGbPerMonth: isSet6(object.storageGbPerMonth) ? globalThis.Number(object.storageGbPerMonth) : 0,
      networkGbPerMonth: isSet6(object.networkGbPerMonth) ? globalThis.Number(object.networkGbPerMonth) : 0,
      monthsTotal: isSet6(object.monthsTotal) ? globalThis.Number(object.monthsTotal) : 0,
      metadata: isSet6(object.metadata) ? globalThis.String(object.metadata) : ""
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.client !== "") {
      obj.client = message.client;
    }
    if (message.gatewayId !== 0) {
      obj.gatewayId = Math.round(message.gatewayId);
    }
    if (message.priceUlmn !== 0) {
      obj.priceUlmn = Math.round(message.priceUlmn);
    }
    if (message.storageGbPerMonth !== 0) {
      obj.storageGbPerMonth = Math.round(message.storageGbPerMonth);
    }
    if (message.networkGbPerMonth !== 0) {
      obj.networkGbPerMonth = Math.round(message.networkGbPerMonth);
    }
    if (message.monthsTotal !== 0) {
      obj.monthsTotal = Math.round(message.monthsTotal);
    }
    if (message.metadata !== "") {
      obj.metadata = message.metadata;
    }
    return obj;
  },
  create(base) {
    return MsgCreateContract.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseMsgCreateContract();
    message.client = object.client ?? "";
    message.gatewayId = object.gatewayId ?? 0;
    message.priceUlmn = object.priceUlmn ?? 0;
    message.storageGbPerMonth = object.storageGbPerMonth ?? 0;
    message.networkGbPerMonth = object.networkGbPerMonth ?? 0;
    message.monthsTotal = object.monthsTotal ?? 0;
    message.metadata = object.metadata ?? "";
    return message;
  }
};
function createBaseMsgClaimPayment() {
  return { operator: "", contractId: 0 };
}
var MsgClaimPayment = {
  encode(message, writer = new BinaryWriter()) {
    if (message.operator !== "") {
      writer.uint32(10).string(message.operator);
    }
    if (message.contractId !== 0) {
      writer.uint32(16).uint64(message.contractId);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseMsgClaimPayment();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.operator = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 16) {
            break;
          }
          message.contractId = longToNumber5(reader.uint64());
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      operator: isSet6(object.operator) ? globalThis.String(object.operator) : "",
      contractId: isSet6(object.contractId) ? globalThis.Number(object.contractId) : 0
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.operator !== "") {
      obj.operator = message.operator;
    }
    if (message.contractId !== 0) {
      obj.contractId = Math.round(message.contractId);
    }
    return obj;
  },
  create(base) {
    return MsgClaimPayment.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseMsgClaimPayment();
    message.operator = object.operator ?? "";
    message.contractId = object.contractId ?? 0;
    return message;
  }
};
function createBaseMsgCancelContract() {
  return { client: "", contractId: 0 };
}
var MsgCancelContract = {
  encode(message, writer = new BinaryWriter()) {
    if (message.client !== "") {
      writer.uint32(10).string(message.client);
    }
    if (message.contractId !== 0) {
      writer.uint32(16).uint64(message.contractId);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseMsgCancelContract();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.client = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 16) {
            break;
          }
          message.contractId = longToNumber5(reader.uint64());
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      client: isSet6(object.client) ? globalThis.String(object.client) : "",
      contractId: isSet6(object.contractId) ? globalThis.Number(object.contractId) : 0
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.client !== "") {
      obj.client = message.client;
    }
    if (message.contractId !== 0) {
      obj.contractId = Math.round(message.contractId);
    }
    return obj;
  },
  create(base) {
    return MsgCancelContract.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseMsgCancelContract();
    message.client = object.client ?? "";
    message.contractId = object.contractId ?? 0;
    return message;
  }
};
function createBaseMsgFinalizeContract() {
  return { finalizer: "", contractId: 0 };
}
var MsgFinalizeContract = {
  encode(message, writer = new BinaryWriter()) {
    if (message.finalizer !== "") {
      writer.uint32(10).string(message.finalizer);
    }
    if (message.contractId !== 0) {
      writer.uint32(16).uint64(message.contractId);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseMsgFinalizeContract();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.finalizer = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 16) {
            break;
          }
          message.contractId = longToNumber5(reader.uint64());
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      finalizer: isSet6(object.finalizer) ? globalThis.String(object.finalizer) : "",
      contractId: isSet6(object.contractId) ? globalThis.Number(object.contractId) : 0
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.finalizer !== "") {
      obj.finalizer = message.finalizer;
    }
    if (message.contractId !== 0) {
      obj.contractId = Math.round(message.contractId);
    }
    return obj;
  },
  create(base) {
    return MsgFinalizeContract.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseMsgFinalizeContract();
    message.finalizer = object.finalizer ?? "";
    message.contractId = object.contractId ?? 0;
    return message;
  }
};
function longToNumber5(int64) {
  const num = globalThis.Number(int64.toString());
  if (num > globalThis.Number.MAX_SAFE_INTEGER) {
    throw new globalThis.Error("Value is larger than Number.MAX_SAFE_INTEGER");
  }
  if (num < globalThis.Number.MIN_SAFE_INTEGER) {
    throw new globalThis.Error("Value is smaller than Number.MIN_SAFE_INTEGER");
  }
  return num;
}
function isSet6(value) {
  return value !== null && value !== void 0;
}
function createBaseParams3() {
  return {
    allowedPublishers: [],
    channels: [],
    maxArtifacts: 0,
    maxUrlsPerArt: 0,
    maxSigsPerArt: 0,
    maxNotesLen: 0,
    publishFeeUlmn: 0,
    maxPendingTtl: 0,
    daoPublishers: [],
    rejectRefundBps: 0,
    requireValidationForStable: false
  };
}
var Params3 = {
  encode(message, writer = new BinaryWriter()) {
    for (const v of message.allowedPublishers) {
      writer.uint32(10).string(v);
    }
    for (const v of message.channels) {
      writer.uint32(18).string(v);
    }
    if (message.maxArtifacts !== 0) {
      writer.uint32(24).uint32(message.maxArtifacts);
    }
    if (message.maxUrlsPerArt !== 0) {
      writer.uint32(32).uint32(message.maxUrlsPerArt);
    }
    if (message.maxSigsPerArt !== 0) {
      writer.uint32(40).uint32(message.maxSigsPerArt);
    }
    if (message.maxNotesLen !== 0) {
      writer.uint32(48).uint32(message.maxNotesLen);
    }
    if (message.publishFeeUlmn !== 0) {
      writer.uint32(56).uint64(message.publishFeeUlmn);
    }
    if (message.maxPendingTtl !== 0) {
      writer.uint32(64).uint64(message.maxPendingTtl);
    }
    for (const v of message.daoPublishers) {
      writer.uint32(74).string(v);
    }
    if (message.rejectRefundBps !== 0) {
      writer.uint32(80).uint32(message.rejectRefundBps);
    }
    if (message.requireValidationForStable !== false) {
      writer.uint32(88).bool(message.requireValidationForStable);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseParams3();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.allowedPublishers.push(reader.string());
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.channels.push(reader.string());
          continue;
        }
        case 3: {
          if (tag !== 24) {
            break;
          }
          message.maxArtifacts = reader.uint32();
          continue;
        }
        case 4: {
          if (tag !== 32) {
            break;
          }
          message.maxUrlsPerArt = reader.uint32();
          continue;
        }
        case 5: {
          if (tag !== 40) {
            break;
          }
          message.maxSigsPerArt = reader.uint32();
          continue;
        }
        case 6: {
          if (tag !== 48) {
            break;
          }
          message.maxNotesLen = reader.uint32();
          continue;
        }
        case 7: {
          if (tag !== 56) {
            break;
          }
          message.publishFeeUlmn = longToNumber6(reader.uint64());
          continue;
        }
        case 8: {
          if (tag !== 64) {
            break;
          }
          message.maxPendingTtl = longToNumber6(reader.uint64());
          continue;
        }
        case 9: {
          if (tag !== 74) {
            break;
          }
          message.daoPublishers.push(reader.string());
          continue;
        }
        case 10: {
          if (tag !== 80) {
            break;
          }
          message.rejectRefundBps = reader.uint32();
          continue;
        }
        case 11: {
          if (tag !== 88) {
            break;
          }
          message.requireValidationForStable = reader.bool();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      allowedPublishers: globalThis.Array.isArray(object?.allowedPublishers) ? object.allowedPublishers.map((e) => globalThis.String(e)) : [],
      channels: globalThis.Array.isArray(object?.channels) ? object.channels.map((e) => globalThis.String(e)) : [],
      maxArtifacts: isSet7(object.maxArtifacts) ? globalThis.Number(object.maxArtifacts) : 0,
      maxUrlsPerArt: isSet7(object.maxUrlsPerArt) ? globalThis.Number(object.maxUrlsPerArt) : 0,
      maxSigsPerArt: isSet7(object.maxSigsPerArt) ? globalThis.Number(object.maxSigsPerArt) : 0,
      maxNotesLen: isSet7(object.maxNotesLen) ? globalThis.Number(object.maxNotesLen) : 0,
      publishFeeUlmn: isSet7(object.publishFeeUlmn) ? globalThis.Number(object.publishFeeUlmn) : 0,
      maxPendingTtl: isSet7(object.maxPendingTtl) ? globalThis.Number(object.maxPendingTtl) : 0,
      daoPublishers: globalThis.Array.isArray(object?.daoPublishers) ? object.daoPublishers.map((e) => globalThis.String(e)) : [],
      rejectRefundBps: isSet7(object.rejectRefundBps) ? globalThis.Number(object.rejectRefundBps) : 0,
      requireValidationForStable: isSet7(object.requireValidationForStable) ? globalThis.Boolean(object.requireValidationForStable) : false
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.allowedPublishers?.length) {
      obj.allowedPublishers = message.allowedPublishers;
    }
    if (message.channels?.length) {
      obj.channels = message.channels;
    }
    if (message.maxArtifacts !== 0) {
      obj.maxArtifacts = Math.round(message.maxArtifacts);
    }
    if (message.maxUrlsPerArt !== 0) {
      obj.maxUrlsPerArt = Math.round(message.maxUrlsPerArt);
    }
    if (message.maxSigsPerArt !== 0) {
      obj.maxSigsPerArt = Math.round(message.maxSigsPerArt);
    }
    if (message.maxNotesLen !== 0) {
      obj.maxNotesLen = Math.round(message.maxNotesLen);
    }
    if (message.publishFeeUlmn !== 0) {
      obj.publishFeeUlmn = Math.round(message.publishFeeUlmn);
    }
    if (message.maxPendingTtl !== 0) {
      obj.maxPendingTtl = Math.round(message.maxPendingTtl);
    }
    if (message.daoPublishers?.length) {
      obj.daoPublishers = message.daoPublishers;
    }
    if (message.rejectRefundBps !== 0) {
      obj.rejectRefundBps = Math.round(message.rejectRefundBps);
    }
    if (message.requireValidationForStable !== false) {
      obj.requireValidationForStable = message.requireValidationForStable;
    }
    return obj;
  },
  create(base) {
    return Params3.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseParams3();
    message.allowedPublishers = object.allowedPublishers?.map((e) => e) || [];
    message.channels = object.channels?.map((e) => e) || [];
    message.maxArtifacts = object.maxArtifacts ?? 0;
    message.maxUrlsPerArt = object.maxUrlsPerArt ?? 0;
    message.maxSigsPerArt = object.maxSigsPerArt ?? 0;
    message.maxNotesLen = object.maxNotesLen ?? 0;
    message.publishFeeUlmn = object.publishFeeUlmn ?? 0;
    message.maxPendingTtl = object.maxPendingTtl ?? 0;
    message.daoPublishers = object.daoPublishers?.map((e) => e) || [];
    message.rejectRefundBps = object.rejectRefundBps ?? 0;
    message.requireValidationForStable = object.requireValidationForStable ?? false;
    return message;
  }
};
function longToNumber6(int64) {
  const num = globalThis.Number(int64.toString());
  if (num > globalThis.Number.MAX_SAFE_INTEGER) {
    throw new globalThis.Error("Value is larger than Number.MAX_SAFE_INTEGER");
  }
  if (num < globalThis.Number.MIN_SAFE_INTEGER) {
    throw new globalThis.Error("Value is smaller than Number.MIN_SAFE_INTEGER");
  }
  return num;
}
function isSet7(value) {
  return value !== null && value !== void 0;
}
function release_ReleaseStatusFromJSON(object) {
  switch (object) {
    case 0:
    case "PENDING":
      return 0 /* PENDING */;
    case 1:
    case "VALIDATED":
      return 1 /* VALIDATED */;
    case 2:
    case "REJECTED":
      return 2 /* REJECTED */;
    case 3:
    case "EXPIRED":
      return 3 /* EXPIRED */;
    case -1:
    case "UNRECOGNIZED":
    default:
      return -1 /* UNRECOGNIZED */;
  }
}
function release_ReleaseStatusToJSON(object) {
  switch (object) {
    case 0 /* PENDING */:
      return "PENDING";
    case 1 /* VALIDATED */:
      return "VALIDATED";
    case 2 /* REJECTED */:
      return "REJECTED";
    case 3 /* EXPIRED */:
      return "EXPIRED";
    case -1 /* UNRECOGNIZED */:
    default:
      return "UNRECOGNIZED";
  }
}
function createBaseSignature() {
  return { keyId: "", algo: "", sig: new Uint8Array(0) };
}
var Signature = {
  encode(message, writer = new BinaryWriter()) {
    if (message.keyId !== "") {
      writer.uint32(10).string(message.keyId);
    }
    if (message.algo !== "") {
      writer.uint32(18).string(message.algo);
    }
    if (message.sig.length !== 0) {
      writer.uint32(26).bytes(message.sig);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseSignature();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.keyId = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.algo = reader.string();
          continue;
        }
        case 3: {
          if (tag !== 26) {
            break;
          }
          message.sig = reader.bytes();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      keyId: isSet8(object.keyId) ? globalThis.String(object.keyId) : "",
      algo: isSet8(object.algo) ? globalThis.String(object.algo) : "",
      sig: isSet8(object.sig) ? bytesFromBase64(object.sig) : new Uint8Array(0)
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.keyId !== "") {
      obj.keyId = message.keyId;
    }
    if (message.algo !== "") {
      obj.algo = message.algo;
    }
    if (message.sig.length !== 0) {
      obj.sig = base64FromBytes(message.sig);
    }
    return obj;
  },
  create(base) {
    return Signature.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseSignature();
    message.keyId = object.keyId ?? "";
    message.algo = object.algo ?? "";
    message.sig = object.sig ?? new Uint8Array(0);
    return message;
  }
};
function createBaseArtifact() {
  return { platform: "", kind: "", cid: "", sha256Hex: "", size: 0, urls: [], signatures: [] };
}
var Artifact = {
  encode(message, writer = new BinaryWriter()) {
    if (message.platform !== "") {
      writer.uint32(10).string(message.platform);
    }
    if (message.kind !== "") {
      writer.uint32(18).string(message.kind);
    }
    if (message.cid !== "") {
      writer.uint32(26).string(message.cid);
    }
    if (message.sha256Hex !== "") {
      writer.uint32(34).string(message.sha256Hex);
    }
    if (message.size !== 0) {
      writer.uint32(40).uint64(message.size);
    }
    for (const v of message.urls) {
      writer.uint32(50).string(v);
    }
    for (const v of message.signatures) {
      Signature.encode(v, writer.uint32(58).fork()).join();
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseArtifact();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.platform = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.kind = reader.string();
          continue;
        }
        case 3: {
          if (tag !== 26) {
            break;
          }
          message.cid = reader.string();
          continue;
        }
        case 4: {
          if (tag !== 34) {
            break;
          }
          message.sha256Hex = reader.string();
          continue;
        }
        case 5: {
          if (tag !== 40) {
            break;
          }
          message.size = longToNumber7(reader.uint64());
          continue;
        }
        case 6: {
          if (tag !== 50) {
            break;
          }
          message.urls.push(reader.string());
          continue;
        }
        case 7: {
          if (tag !== 58) {
            break;
          }
          message.signatures.push(Signature.decode(reader, reader.uint32()));
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      platform: isSet8(object.platform) ? globalThis.String(object.platform) : "",
      kind: isSet8(object.kind) ? globalThis.String(object.kind) : "",
      cid: isSet8(object.cid) ? globalThis.String(object.cid) : "",
      sha256Hex: isSet8(object.sha256Hex) ? globalThis.String(object.sha256Hex) : "",
      size: isSet8(object.size) ? globalThis.Number(object.size) : 0,
      urls: globalThis.Array.isArray(object?.urls) ? object.urls.map((e) => globalThis.String(e)) : [],
      signatures: globalThis.Array.isArray(object?.signatures) ? object.signatures.map((e) => Signature.fromJSON(e)) : []
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.platform !== "") {
      obj.platform = message.platform;
    }
    if (message.kind !== "") {
      obj.kind = message.kind;
    }
    if (message.cid !== "") {
      obj.cid = message.cid;
    }
    if (message.sha256Hex !== "") {
      obj.sha256Hex = message.sha256Hex;
    }
    if (message.size !== 0) {
      obj.size = Math.round(message.size);
    }
    if (message.urls?.length) {
      obj.urls = message.urls;
    }
    if (message.signatures?.length) {
      obj.signatures = message.signatures.map((e) => Signature.toJSON(e));
    }
    return obj;
  },
  create(base) {
    return Artifact.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseArtifact();
    message.platform = object.platform ?? "";
    message.kind = object.kind ?? "";
    message.cid = object.cid ?? "";
    message.sha256Hex = object.sha256Hex ?? "";
    message.size = object.size ?? 0;
    message.urls = object.urls?.map((e) => e) || [];
    message.signatures = object.signatures?.map((e) => Signature.fromPartial(e)) || [];
    return message;
  }
};
function createBaseRelease() {
  return {
    id: 0,
    version: "",
    channel: "",
    artifacts: [],
    publisher: "",
    notes: "",
    createdAt: 0,
    yanked: false,
    supersedes: [],
    status: 0,
    emergencyOk: false,
    emergencyUntil: 0
  };
}
var Release = {
  encode(message, writer = new BinaryWriter()) {
    if (message.id !== 0) {
      writer.uint32(8).uint64(message.id);
    }
    if (message.version !== "") {
      writer.uint32(18).string(message.version);
    }
    if (message.channel !== "") {
      writer.uint32(26).string(message.channel);
    }
    for (const v of message.artifacts) {
      Artifact.encode(v, writer.uint32(34).fork()).join();
    }
    if (message.publisher !== "") {
      writer.uint32(42).string(message.publisher);
    }
    if (message.notes !== "") {
      writer.uint32(50).string(message.notes);
    }
    if (message.createdAt !== 0) {
      writer.uint32(56).int64(message.createdAt);
    }
    if (message.yanked !== false) {
      writer.uint32(64).bool(message.yanked);
    }
    writer.uint32(74).fork();
    for (const v of message.supersedes) {
      writer.uint64(v);
    }
    writer.join();
    if (message.status !== 0) {
      writer.uint32(80).int32(message.status);
    }
    if (message.emergencyOk !== false) {
      writer.uint32(88).bool(message.emergencyOk);
    }
    if (message.emergencyUntil !== 0) {
      writer.uint32(96).int64(message.emergencyUntil);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseRelease();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 8) {
            break;
          }
          message.id = longToNumber7(reader.uint64());
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.version = reader.string();
          continue;
        }
        case 3: {
          if (tag !== 26) {
            break;
          }
          message.channel = reader.string();
          continue;
        }
        case 4: {
          if (tag !== 34) {
            break;
          }
          message.artifacts.push(Artifact.decode(reader, reader.uint32()));
          continue;
        }
        case 5: {
          if (tag !== 42) {
            break;
          }
          message.publisher = reader.string();
          continue;
        }
        case 6: {
          if (tag !== 50) {
            break;
          }
          message.notes = reader.string();
          continue;
        }
        case 7: {
          if (tag !== 56) {
            break;
          }
          message.createdAt = longToNumber7(reader.int64());
          continue;
        }
        case 8: {
          if (tag !== 64) {
            break;
          }
          message.yanked = reader.bool();
          continue;
        }
        case 9: {
          if (tag === 72) {
            message.supersedes.push(longToNumber7(reader.uint64()));
            continue;
          }
          if (tag === 74) {
            const end2 = reader.uint32() + reader.pos;
            while (reader.pos < end2) {
              message.supersedes.push(longToNumber7(reader.uint64()));
            }
            continue;
          }
          break;
        }
        case 10: {
          if (tag !== 80) {
            break;
          }
          message.status = reader.int32();
          continue;
        }
        case 11: {
          if (tag !== 88) {
            break;
          }
          message.emergencyOk = reader.bool();
          continue;
        }
        case 12: {
          if (tag !== 96) {
            break;
          }
          message.emergencyUntil = longToNumber7(reader.int64());
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      id: isSet8(object.id) ? globalThis.Number(object.id) : 0,
      version: isSet8(object.version) ? globalThis.String(object.version) : "",
      channel: isSet8(object.channel) ? globalThis.String(object.channel) : "",
      artifacts: globalThis.Array.isArray(object?.artifacts) ? object.artifacts.map((e) => Artifact.fromJSON(e)) : [],
      publisher: isSet8(object.publisher) ? globalThis.String(object.publisher) : "",
      notes: isSet8(object.notes) ? globalThis.String(object.notes) : "",
      createdAt: isSet8(object.createdAt) ? globalThis.Number(object.createdAt) : 0,
      yanked: isSet8(object.yanked) ? globalThis.Boolean(object.yanked) : false,
      supersedes: globalThis.Array.isArray(object?.supersedes) ? object.supersedes.map((e) => globalThis.Number(e)) : [],
      status: isSet8(object.status) ? release_ReleaseStatusFromJSON(object.status) : 0,
      emergencyOk: isSet8(object.emergencyOk) ? globalThis.Boolean(object.emergencyOk) : false,
      emergencyUntil: isSet8(object.emergencyUntil) ? globalThis.Number(object.emergencyUntil) : 0
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.id !== 0) {
      obj.id = Math.round(message.id);
    }
    if (message.version !== "") {
      obj.version = message.version;
    }
    if (message.channel !== "") {
      obj.channel = message.channel;
    }
    if (message.artifacts?.length) {
      obj.artifacts = message.artifacts.map((e) => Artifact.toJSON(e));
    }
    if (message.publisher !== "") {
      obj.publisher = message.publisher;
    }
    if (message.notes !== "") {
      obj.notes = message.notes;
    }
    if (message.createdAt !== 0) {
      obj.createdAt = Math.round(message.createdAt);
    }
    if (message.yanked !== false) {
      obj.yanked = message.yanked;
    }
    if (message.supersedes?.length) {
      obj.supersedes = message.supersedes.map((e) => Math.round(e));
    }
    if (message.status !== 0) {
      obj.status = release_ReleaseStatusToJSON(message.status);
    }
    if (message.emergencyOk !== false) {
      obj.emergencyOk = message.emergencyOk;
    }
    if (message.emergencyUntil !== 0) {
      obj.emergencyUntil = Math.round(message.emergencyUntil);
    }
    return obj;
  },
  create(base) {
    return Release.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseRelease();
    message.id = object.id ?? 0;
    message.version = object.version ?? "";
    message.channel = object.channel ?? "";
    message.artifacts = object.artifacts?.map((e) => Artifact.fromPartial(e)) || [];
    message.publisher = object.publisher ?? "";
    message.notes = object.notes ?? "";
    message.createdAt = object.createdAt ?? 0;
    message.yanked = object.yanked ?? false;
    message.supersedes = object.supersedes?.map((e) => e) || [];
    message.status = object.status ?? 0;
    message.emergencyOk = object.emergencyOk ?? false;
    message.emergencyUntil = object.emergencyUntil ?? 0;
    return message;
  }
};
function bytesFromBase64(b64) {
  if (globalThis.Buffer) {
    return Uint8Array.from(globalThis.Buffer.from(b64, "base64"));
  } else {
    const bin = globalThis.atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; ++i) {
      arr[i] = bin.charCodeAt(i);
    }
    return arr;
  }
}
function base64FromBytes(arr) {
  if (globalThis.Buffer) {
    return globalThis.Buffer.from(arr).toString("base64");
  } else {
    const bin = [];
    arr.forEach((byte) => {
      bin.push(globalThis.String.fromCharCode(byte));
    });
    return globalThis.btoa(bin.join(""));
  }
}
function longToNumber7(int64) {
  const num = globalThis.Number(int64.toString());
  if (num > globalThis.Number.MAX_SAFE_INTEGER) {
    throw new globalThis.Error("Value is larger than Number.MAX_SAFE_INTEGER");
  }
  if (num < globalThis.Number.MIN_SAFE_INTEGER) {
    throw new globalThis.Error("Value is smaller than Number.MIN_SAFE_INTEGER");
  }
  return num;
}
function isSet8(value) {
  return value !== null && value !== void 0;
}

// src/types/lumen/release/v1/tx.ts
function createBaseMsgPublishRelease() {
  return { creator: "", release: void 0 };
}
var MsgPublishRelease = {
  encode(message, writer = new BinaryWriter()) {
    if (message.creator !== "") {
      writer.uint32(10).string(message.creator);
    }
    if (message.release !== void 0) {
      Release.encode(message.release, writer.uint32(18).fork()).join();
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseMsgPublishRelease();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.creator = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.release = Release.decode(reader, reader.uint32());
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      creator: isSet9(object.creator) ? globalThis.String(object.creator) : "",
      release: isSet9(object.release) ? Release.fromJSON(object.release) : void 0
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.creator !== "") {
      obj.creator = message.creator;
    }
    if (message.release !== void 0) {
      obj.release = Release.toJSON(message.release);
    }
    return obj;
  },
  create(base) {
    return MsgPublishRelease.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseMsgPublishRelease();
    message.creator = object.creator ?? "";
    message.release = object.release !== void 0 && object.release !== null ? Release.fromPartial(object.release) : void 0;
    return message;
  }
};
function createBaseMsgYankRelease() {
  return { creator: "", id: 0 };
}
var MsgYankRelease = {
  encode(message, writer = new BinaryWriter()) {
    if (message.creator !== "") {
      writer.uint32(10).string(message.creator);
    }
    if (message.id !== 0) {
      writer.uint32(16).uint64(message.id);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseMsgYankRelease();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.creator = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 16) {
            break;
          }
          message.id = longToNumber8(reader.uint64());
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      creator: isSet9(object.creator) ? globalThis.String(object.creator) : "",
      id: isSet9(object.id) ? globalThis.Number(object.id) : 0
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.creator !== "") {
      obj.creator = message.creator;
    }
    if (message.id !== 0) {
      obj.id = Math.round(message.id);
    }
    return obj;
  },
  create(base) {
    return MsgYankRelease.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseMsgYankRelease();
    message.creator = object.creator ?? "";
    message.id = object.id ?? 0;
    return message;
  }
};
function createBaseMsgMirrorRelease() {
  return { creator: "", id: 0, artifactIndex: 0, newUrls: [] };
}
var MsgMirrorRelease = {
  encode(message, writer = new BinaryWriter()) {
    if (message.creator !== "") {
      writer.uint32(10).string(message.creator);
    }
    if (message.id !== 0) {
      writer.uint32(16).uint64(message.id);
    }
    if (message.artifactIndex !== 0) {
      writer.uint32(24).uint32(message.artifactIndex);
    }
    for (const v of message.newUrls) {
      writer.uint32(34).string(v);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseMsgMirrorRelease();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.creator = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 16) {
            break;
          }
          message.id = longToNumber8(reader.uint64());
          continue;
        }
        case 3: {
          if (tag !== 24) {
            break;
          }
          message.artifactIndex = reader.uint32();
          continue;
        }
        case 4: {
          if (tag !== 34) {
            break;
          }
          message.newUrls.push(reader.string());
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      creator: isSet9(object.creator) ? globalThis.String(object.creator) : "",
      id: isSet9(object.id) ? globalThis.Number(object.id) : 0,
      artifactIndex: isSet9(object.artifactIndex) ? globalThis.Number(object.artifactIndex) : 0,
      newUrls: globalThis.Array.isArray(object?.newUrls) ? object.newUrls.map((e) => globalThis.String(e)) : []
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.creator !== "") {
      obj.creator = message.creator;
    }
    if (message.id !== 0) {
      obj.id = Math.round(message.id);
    }
    if (message.artifactIndex !== 0) {
      obj.artifactIndex = Math.round(message.artifactIndex);
    }
    if (message.newUrls?.length) {
      obj.newUrls = message.newUrls;
    }
    return obj;
  },
  create(base) {
    return MsgMirrorRelease.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseMsgMirrorRelease();
    message.creator = object.creator ?? "";
    message.id = object.id ?? 0;
    message.artifactIndex = object.artifactIndex ?? 0;
    message.newUrls = object.newUrls?.map((e) => e) || [];
    return message;
  }
};
function createBaseMsgSetEmergency() {
  return { creator: "", id: 0, emergencyOk: false, emergencyTtl: 0 };
}
var MsgSetEmergency = {
  encode(message, writer = new BinaryWriter()) {
    if (message.creator !== "") {
      writer.uint32(10).string(message.creator);
    }
    if (message.id !== 0) {
      writer.uint32(16).uint64(message.id);
    }
    if (message.emergencyOk !== false) {
      writer.uint32(24).bool(message.emergencyOk);
    }
    if (message.emergencyTtl !== 0) {
      writer.uint32(32).int64(message.emergencyTtl);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseMsgSetEmergency();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.creator = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 16) {
            break;
          }
          message.id = longToNumber8(reader.uint64());
          continue;
        }
        case 3: {
          if (tag !== 24) {
            break;
          }
          message.emergencyOk = reader.bool();
          continue;
        }
        case 4: {
          if (tag !== 32) {
            break;
          }
          message.emergencyTtl = longToNumber8(reader.int64());
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      creator: isSet9(object.creator) ? globalThis.String(object.creator) : "",
      id: isSet9(object.id) ? globalThis.Number(object.id) : 0,
      emergencyOk: isSet9(object.emergencyOk) ? globalThis.Boolean(object.emergencyOk) : false,
      emergencyTtl: isSet9(object.emergencyTtl) ? globalThis.Number(object.emergencyTtl) : 0
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.creator !== "") {
      obj.creator = message.creator;
    }
    if (message.id !== 0) {
      obj.id = Math.round(message.id);
    }
    if (message.emergencyOk !== false) {
      obj.emergencyOk = message.emergencyOk;
    }
    if (message.emergencyTtl !== 0) {
      obj.emergencyTtl = Math.round(message.emergencyTtl);
    }
    return obj;
  },
  create(base) {
    return MsgSetEmergency.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseMsgSetEmergency();
    message.creator = object.creator ?? "";
    message.id = object.id ?? 0;
    message.emergencyOk = object.emergencyOk ?? false;
    message.emergencyTtl = object.emergencyTtl ?? 0;
    return message;
  }
};
function createBaseMsgValidateRelease() {
  return { authority: "", id: 0 };
}
var MsgValidateRelease = {
  encode(message, writer = new BinaryWriter()) {
    if (message.authority !== "") {
      writer.uint32(10).string(message.authority);
    }
    if (message.id !== 0) {
      writer.uint32(16).uint64(message.id);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseMsgValidateRelease();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.authority = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 16) {
            break;
          }
          message.id = longToNumber8(reader.uint64());
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      authority: isSet9(object.authority) ? globalThis.String(object.authority) : "",
      id: isSet9(object.id) ? globalThis.Number(object.id) : 0
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.authority !== "") {
      obj.authority = message.authority;
    }
    if (message.id !== 0) {
      obj.id = Math.round(message.id);
    }
    return obj;
  },
  create(base) {
    return MsgValidateRelease.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseMsgValidateRelease();
    message.authority = object.authority ?? "";
    message.id = object.id ?? 0;
    return message;
  }
};
function createBaseMsgRejectRelease() {
  return { authority: "", id: 0 };
}
var MsgRejectRelease = {
  encode(message, writer = new BinaryWriter()) {
    if (message.authority !== "") {
      writer.uint32(10).string(message.authority);
    }
    if (message.id !== 0) {
      writer.uint32(16).uint64(message.id);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseMsgRejectRelease();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.authority = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 16) {
            break;
          }
          message.id = longToNumber8(reader.uint64());
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      authority: isSet9(object.authority) ? globalThis.String(object.authority) : "",
      id: isSet9(object.id) ? globalThis.Number(object.id) : 0
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.authority !== "") {
      obj.authority = message.authority;
    }
    if (message.id !== 0) {
      obj.id = Math.round(message.id);
    }
    return obj;
  },
  create(base) {
    return MsgRejectRelease.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseMsgRejectRelease();
    message.authority = object.authority ?? "";
    message.id = object.id ?? 0;
    return message;
  }
};
function createBaseMsgUpdateParams3() {
  return { authority: "", params: void 0 };
}
var MsgUpdateParams3 = {
  encode(message, writer = new BinaryWriter()) {
    if (message.authority !== "") {
      writer.uint32(10).string(message.authority);
    }
    if (message.params !== void 0) {
      Params3.encode(message.params, writer.uint32(18).fork()).join();
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseMsgUpdateParams3();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.authority = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.params = Params3.decode(reader, reader.uint32());
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      authority: isSet9(object.authority) ? globalThis.String(object.authority) : "",
      params: isSet9(object.params) ? Params3.fromJSON(object.params) : void 0
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.authority !== "") {
      obj.authority = message.authority;
    }
    if (message.params !== void 0) {
      obj.params = Params3.toJSON(message.params);
    }
    return obj;
  },
  create(base) {
    return MsgUpdateParams3.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseMsgUpdateParams3();
    message.authority = object.authority ?? "";
    message.params = object.params !== void 0 && object.params !== null ? Params3.fromPartial(object.params) : void 0;
    return message;
  }
};
function longToNumber8(int64) {
  const num = globalThis.Number(int64.toString());
  if (num > globalThis.Number.MAX_SAFE_INTEGER) {
    throw new globalThis.Error("Value is larger than Number.MAX_SAFE_INTEGER");
  }
  if (num < globalThis.Number.MIN_SAFE_INTEGER) {
    throw new globalThis.Error("Value is smaller than Number.MIN_SAFE_INTEGER");
  }
  return num;
}
function isSet9(value) {
  return value !== null && value !== void 0;
}
function createBaseParams4() {
  return {
    txTaxRate: "",
    initialRewardPerBlockLumn: 0,
    halvingIntervalBlocks: 0,
    supplyCapLumn: 0,
    decimals: 0,
    minSendUlmn: 0,
    denom: "",
    distributionIntervalBlocks: 0
  };
}
var Params4 = {
  encode(message, writer = new BinaryWriter()) {
    if (message.txTaxRate !== "") {
      writer.uint32(10).string(message.txTaxRate);
    }
    if (message.initialRewardPerBlockLumn !== 0) {
      writer.uint32(16).uint64(message.initialRewardPerBlockLumn);
    }
    if (message.halvingIntervalBlocks !== 0) {
      writer.uint32(24).uint64(message.halvingIntervalBlocks);
    }
    if (message.supplyCapLumn !== 0) {
      writer.uint32(32).uint64(message.supplyCapLumn);
    }
    if (message.decimals !== 0) {
      writer.uint32(40).uint32(message.decimals);
    }
    if (message.minSendUlmn !== 0) {
      writer.uint32(48).uint64(message.minSendUlmn);
    }
    if (message.denom !== "") {
      writer.uint32(58).string(message.denom);
    }
    if (message.distributionIntervalBlocks !== 0) {
      writer.uint32(64).uint64(message.distributionIntervalBlocks);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseParams4();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.txTaxRate = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 16) {
            break;
          }
          message.initialRewardPerBlockLumn = longToNumber9(reader.uint64());
          continue;
        }
        case 3: {
          if (tag !== 24) {
            break;
          }
          message.halvingIntervalBlocks = longToNumber9(reader.uint64());
          continue;
        }
        case 4: {
          if (tag !== 32) {
            break;
          }
          message.supplyCapLumn = longToNumber9(reader.uint64());
          continue;
        }
        case 5: {
          if (tag !== 40) {
            break;
          }
          message.decimals = reader.uint32();
          continue;
        }
        case 6: {
          if (tag !== 48) {
            break;
          }
          message.minSendUlmn = longToNumber9(reader.uint64());
          continue;
        }
        case 7: {
          if (tag !== 58) {
            break;
          }
          message.denom = reader.string();
          continue;
        }
        case 8: {
          if (tag !== 64) {
            break;
          }
          message.distributionIntervalBlocks = longToNumber9(reader.uint64());
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      txTaxRate: isSet10(object.txTaxRate) ? globalThis.String(object.txTaxRate) : "",
      initialRewardPerBlockLumn: isSet10(object.initialRewardPerBlockLumn) ? globalThis.Number(object.initialRewardPerBlockLumn) : 0,
      halvingIntervalBlocks: isSet10(object.halvingIntervalBlocks) ? globalThis.Number(object.halvingIntervalBlocks) : 0,
      supplyCapLumn: isSet10(object.supplyCapLumn) ? globalThis.Number(object.supplyCapLumn) : 0,
      decimals: isSet10(object.decimals) ? globalThis.Number(object.decimals) : 0,
      minSendUlmn: isSet10(object.minSendUlmn) ? globalThis.Number(object.minSendUlmn) : 0,
      denom: isSet10(object.denom) ? globalThis.String(object.denom) : "",
      distributionIntervalBlocks: isSet10(object.distributionIntervalBlocks) ? globalThis.Number(object.distributionIntervalBlocks) : 0
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.txTaxRate !== "") {
      obj.txTaxRate = message.txTaxRate;
    }
    if (message.initialRewardPerBlockLumn !== 0) {
      obj.initialRewardPerBlockLumn = Math.round(message.initialRewardPerBlockLumn);
    }
    if (message.halvingIntervalBlocks !== 0) {
      obj.halvingIntervalBlocks = Math.round(message.halvingIntervalBlocks);
    }
    if (message.supplyCapLumn !== 0) {
      obj.supplyCapLumn = Math.round(message.supplyCapLumn);
    }
    if (message.decimals !== 0) {
      obj.decimals = Math.round(message.decimals);
    }
    if (message.minSendUlmn !== 0) {
      obj.minSendUlmn = Math.round(message.minSendUlmn);
    }
    if (message.denom !== "") {
      obj.denom = message.denom;
    }
    if (message.distributionIntervalBlocks !== 0) {
      obj.distributionIntervalBlocks = Math.round(message.distributionIntervalBlocks);
    }
    return obj;
  },
  create(base) {
    return Params4.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseParams4();
    message.txTaxRate = object.txTaxRate ?? "";
    message.initialRewardPerBlockLumn = object.initialRewardPerBlockLumn ?? 0;
    message.halvingIntervalBlocks = object.halvingIntervalBlocks ?? 0;
    message.supplyCapLumn = object.supplyCapLumn ?? 0;
    message.decimals = object.decimals ?? 0;
    message.minSendUlmn = object.minSendUlmn ?? 0;
    message.denom = object.denom ?? "";
    message.distributionIntervalBlocks = object.distributionIntervalBlocks ?? 0;
    return message;
  }
};
function longToNumber9(int64) {
  const num = globalThis.Number(int64.toString());
  if (num > globalThis.Number.MAX_SAFE_INTEGER) {
    throw new globalThis.Error("Value is larger than Number.MAX_SAFE_INTEGER");
  }
  if (num < globalThis.Number.MIN_SAFE_INTEGER) {
    throw new globalThis.Error("Value is smaller than Number.MIN_SAFE_INTEGER");
  }
  return num;
}
function isSet10(value) {
  return value !== null && value !== void 0;
}

// src/types/lumen/tokenomics/v1/tx.ts
function createBaseMsgUpdateParams4() {
  return { authority: "", params: void 0 };
}
var MsgUpdateParams4 = {
  encode(message, writer = new BinaryWriter()) {
    if (message.authority !== "") {
      writer.uint32(10).string(message.authority);
    }
    if (message.params !== void 0) {
      Params4.encode(message.params, writer.uint32(18).fork()).join();
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseMsgUpdateParams4();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.authority = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.params = Params4.decode(reader, reader.uint32());
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      authority: isSet11(object.authority) ? globalThis.String(object.authority) : "",
      params: isSet11(object.params) ? Params4.fromJSON(object.params) : void 0
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.authority !== "") {
      obj.authority = message.authority;
    }
    if (message.params !== void 0) {
      obj.params = Params4.toJSON(message.params);
    }
    return obj;
  },
  create(base) {
    return MsgUpdateParams4.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseMsgUpdateParams4();
    message.authority = object.authority ?? "";
    message.params = object.params !== void 0 && object.params !== null ? Params4.fromPartial(object.params) : void 0;
    return message;
  }
};
function createBaseMsgUpdateSlashingDowntimeParams() {
  return { authority: "", slashFractionDowntime: "", downtimeJailDuration: "" };
}
var MsgUpdateSlashingDowntimeParams = {
  encode(message, writer = new BinaryWriter()) {
    if (message.authority !== "") {
      writer.uint32(10).string(message.authority);
    }
    if (message.slashFractionDowntime !== "") {
      writer.uint32(18).string(message.slashFractionDowntime);
    }
    if (message.downtimeJailDuration !== "") {
      writer.uint32(26).string(message.downtimeJailDuration);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseMsgUpdateSlashingDowntimeParams();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.authority = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.slashFractionDowntime = reader.string();
          continue;
        }
        case 3: {
          if (tag !== 26) {
            break;
          }
          message.downtimeJailDuration = reader.string();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      authority: isSet11(object.authority) ? globalThis.String(object.authority) : "",
      slashFractionDowntime: isSet11(object.slashFractionDowntime) ? globalThis.String(object.slashFractionDowntime) : "",
      downtimeJailDuration: isSet11(object.downtimeJailDuration) ? globalThis.String(object.downtimeJailDuration) : ""
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.authority !== "") {
      obj.authority = message.authority;
    }
    if (message.slashFractionDowntime !== "") {
      obj.slashFractionDowntime = message.slashFractionDowntime;
    }
    if (message.downtimeJailDuration !== "") {
      obj.downtimeJailDuration = message.downtimeJailDuration;
    }
    return obj;
  },
  create(base) {
    return MsgUpdateSlashingDowntimeParams.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseMsgUpdateSlashingDowntimeParams();
    message.authority = object.authority ?? "";
    message.slashFractionDowntime = object.slashFractionDowntime ?? "";
    message.downtimeJailDuration = object.downtimeJailDuration ?? "";
    return message;
  }
};
function isSet11(value) {
  return value !== null && value !== void 0;
}
function createBaseMsgLinkAccountPQC() {
  return { creator: "", scheme: "", pubKey: new Uint8Array(0), powNonce: new Uint8Array(0) };
}
var MsgLinkAccountPQC = {
  encode(message, writer = new BinaryWriter()) {
    if (message.creator !== "") {
      writer.uint32(10).string(message.creator);
    }
    if (message.scheme !== "") {
      writer.uint32(18).string(message.scheme);
    }
    if (message.pubKey.length !== 0) {
      writer.uint32(26).bytes(message.pubKey);
    }
    if (message.powNonce.length !== 0) {
      writer.uint32(34).bytes(message.powNonce);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBaseMsgLinkAccountPQC();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.creator = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.scheme = reader.string();
          continue;
        }
        case 3: {
          if (tag !== 26) {
            break;
          }
          message.pubKey = reader.bytes();
          continue;
        }
        case 4: {
          if (tag !== 34) {
            break;
          }
          message.powNonce = reader.bytes();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      creator: isSet12(object.creator) ? globalThis.String(object.creator) : "",
      scheme: isSet12(object.scheme) ? globalThis.String(object.scheme) : "",
      pubKey: isSet12(object.pubKey) ? bytesFromBase642(object.pubKey) : new Uint8Array(0),
      powNonce: isSet12(object.powNonce) ? bytesFromBase642(object.powNonce) : new Uint8Array(0)
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.creator !== "") {
      obj.creator = message.creator;
    }
    if (message.scheme !== "") {
      obj.scheme = message.scheme;
    }
    if (message.pubKey.length !== 0) {
      obj.pubKey = base64FromBytes2(message.pubKey);
    }
    if (message.powNonce.length !== 0) {
      obj.powNonce = base64FromBytes2(message.powNonce);
    }
    return obj;
  },
  create(base) {
    return MsgLinkAccountPQC.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBaseMsgLinkAccountPQC();
    message.creator = object.creator ?? "";
    message.scheme = object.scheme ?? "";
    message.pubKey = object.pubKey ?? new Uint8Array(0);
    message.powNonce = object.powNonce ?? new Uint8Array(0);
    return message;
  }
};
function bytesFromBase642(b64) {
  if (globalThis.Buffer) {
    return Uint8Array.from(globalThis.Buffer.from(b64, "base64"));
  } else {
    const bin = globalThis.atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; ++i) {
      arr[i] = bin.charCodeAt(i);
    }
    return arr;
  }
}
function base64FromBytes2(arr) {
  if (globalThis.Buffer) {
    return globalThis.Buffer.from(arr).toString("base64");
  } else {
    const bin = [];
    arr.forEach((byte) => {
      bin.push(globalThis.String.fromCharCode(byte));
    });
    return globalThis.btoa(bin.join(""));
  }
}
function isSet12(value) {
  return value !== null && value !== void 0;
}
var customTypes = [
  ["/lumen.dns.v1.MsgUpdateParams", MsgUpdateParams],
  ["/lumen.dns.v1.MsgRegister", MsgRegister],
  ["/lumen.dns.v1.MsgUpdate", MsgUpdate],
  ["/lumen.dns.v1.MsgRenew", MsgRenew],
  ["/lumen.dns.v1.MsgTransfer", MsgTransfer],
  ["/lumen.dns.v1.MsgBid", MsgBid],
  ["/lumen.dns.v1.MsgSettle", MsgSettle],
  ["/lumen.dns.v1.MsgCreateDomain", MsgCreateDomain],
  ["/lumen.dns.v1.MsgUpdateDomain", MsgUpdateDomain],
  ["/lumen.dns.v1.MsgDeleteDomain", MsgDeleteDomain],
  ["/lumen.dns.v1.MsgCreateAuction", MsgCreateAuction],
  ["/lumen.dns.v1.MsgUpdateAuction", MsgUpdateAuction],
  ["/lumen.dns.v1.MsgDeleteAuction", MsgDeleteAuction],
  ["/lumen.gateway.v1.MsgUpdateParams", MsgUpdateParams2],
  ["/lumen.gateway.v1.MsgRegisterGateway", MsgRegisterGateway],
  ["/lumen.gateway.v1.MsgUpdateGateway", MsgUpdateGateway],
  ["/lumen.gateway.v1.MsgCreateContract", MsgCreateContract],
  ["/lumen.gateway.v1.MsgClaimPayment", MsgClaimPayment],
  ["/lumen.gateway.v1.MsgCancelContract", MsgCancelContract],
  ["/lumen.gateway.v1.MsgFinalizeContract", MsgFinalizeContract],
  ["/lumen.release.v1.MsgPublishRelease", MsgPublishRelease],
  ["/lumen.release.v1.MsgMirrorRelease", MsgMirrorRelease],
  ["/lumen.release.v1.MsgYankRelease", MsgYankRelease],
  ["/lumen.release.v1.MsgSetEmergency", MsgSetEmergency],
  ["/lumen.release.v1.MsgValidateRelease", MsgValidateRelease],
  ["/lumen.release.v1.MsgRejectRelease", MsgRejectRelease],
  ["/lumen.release.v1.MsgUpdateParams", MsgUpdateParams3],
  ["/lumen.tokenomics.v1.MsgUpdateParams", MsgUpdateParams4],
  [
    "/lumen.tokenomics.v1.MsgUpdateSlashingDowntimeParams",
    MsgUpdateSlashingDowntimeParams
  ],
  ["/lumen.pqc.v1.MsgLinkAccountPQC", MsgLinkAccountPQC],
  ["/cosmos.gov.v1.MsgSubmitProposal", MsgSubmitProposal],
  ["/cosmos.gov.v1.MsgDeposit", MsgDeposit],
  ["/cosmos.gov.v1.MsgVote", MsgVote],
  ["/cosmos.gov.v1.MsgVoteWeighted", MsgVoteWeighted],
  ["/cosmos.gov.v1.MsgExecLegacyContent", MsgExecLegacyContent],
  ["/cosmos.gov.v1.MsgUpdateParams", MsgUpdateParams$1]
];
function createRegistry() {
  const registry = new Registry(defaultRegistryTypes);
  for (const [typeUrl, mod] of customTypes) {
    registry.register(typeUrl, mod);
  }
  return registry;
}

// src/modules/index.ts
var modules_exports = {};
__export(modules_exports, {
  DnsModule: () => DnsModule,
  GatewaysModule: () => GatewaysModule,
  GovModule: () => GovModule,
  PqcModule: () => PqcModule,
  ReleasesModule: () => ReleasesModule,
  TokenomicsModule: () => TokenomicsModule
});

// src/rest.ts
var DEFAULT_TIMEOUT = 12e3;
async function fetchJson(url, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? DEFAULT_TIMEOUT);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }
    if (!response.ok) {
      const error = typeof payload === "string" ? payload : response.statusText;
      throw new Error(`${response.status} ${error}`);
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}
function withQuery(url, params) {
  if (!params) return url;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === void 0 || value === null) continue;
    qs.set(key, String(value));
  }
  const query = qs.toString();
  if (!query) return url;
  return `${url}?${query}`;
}
function joinRest(base, suffix) {
  const normalizedBase = base.replace(/\/+$/, "");
  const normalizedSuffix = suffix.startsWith("/") ? suffix : `/${suffix}`;
  return `${normalizedBase}${normalizedSuffix}`;
}

// src/modules/base.ts
var BaseModule = class {
  constructor(restEndpoint) {
    this.restEndpoint = restEndpoint;
  }
  ensureRest() {
    if (!this.restEndpoint) throw new Error("REST endpoint is not configured on LumenClient");
    return this.restEndpoint;
  }
  async get(path2, query, init) {
    const base = this.ensureRest();
    const url = withQuery(joinRest(base, path2), query);
    return fetchJson(url, init);
  }
};

// src/modules/dns.ts
var DnsModule = class extends BaseModule {
  base;
  constructor(restEndpoint) {
    const base = restEndpoint ? joinRest(restEndpoint, "/lumen/dns/v1") : void 0;
    super(base);
    this.base = base;
  }
  // ---- Queries -------------------------------------------------------------
  async params() {
    return this.get("/params");
  }
  async resolve(domain, ext, opts) {
    const segments = [
      encodeURIComponent(domain),
      encodeURIComponent(ext),
      encodeURIComponent(opts?.records ?? "-"),
      String(opts?.expireAt ?? 0),
      encodeURIComponent(opts?.status ?? "-")
    ];
    return this.get(`/resolve/${segments.join("/")}`);
  }
  async domainsByOwner(owner) {
    return this.get(`/domains_by_owner/${encodeURIComponent(owner)}`);
  }
  async auctionStatus(domain, ext) {
    const segments = [
      encodeURIComponent(domain),
      encodeURIComponent(ext),
      "0",
      "-",
      "-"
    ];
    return this.get(`/auction_status/${segments.join("/")}`);
  }
  async baseFeeDns(overrides) {
    const segments = [
      String(overrides?.t ?? 0),
      encodeURIComponent(overrides?.alpha ?? "-"),
      encodeURIComponent(overrides?.floor ?? "-"),
      encodeURIComponent(overrides?.ceiling ?? "-")
    ];
    return this.get(`/base_fee_dns/${segments.join("/")}`);
  }
  async domain(index) {
    return this.get(`/domain/${encodeURIComponent(index)}`);
  }
  async domains(options = {}) {
    return this.get("/domain", paginationParams(options.pageKey, options.limit));
  }
  async auction(index) {
    return this.get(`/auction/${encodeURIComponent(index)}`);
  }
  async auctions(options = {}) {
    return this.get("/auction", paginationParams(options.pageKey, options.limit));
  }
  // ---- Tx composers --------------------------------------------------------
  msgUpdateParams(authority, params) {
    return {
      typeUrl: "/lumen.dns.v1.MsgUpdateParams",
      value: MsgUpdateParams.fromPartial({ authority, params })
    };
  }
  msgRegister(sender, payload) {
    return {
      typeUrl: "/lumen.dns.v1.MsgRegister",
      value: MsgRegister.fromPartial({
        creator: sender,
        domain: payload.domain,
        ext: payload.ext,
        records: payload.records ?? [],
        durationDays: payload.durationDays ?? 0,
        owner: payload.owner ?? ""
      })
    };
  }
  msgUpdate(sender, payload) {
    return {
      typeUrl: "/lumen.dns.v1.MsgUpdate",
      value: MsgUpdate.fromPartial({
        creator: sender,
        domain: payload.domain,
        ext: payload.ext,
        records: payload.records ?? [],
        powNonce: payload.powNonce ?? 0
      })
    };
  }
  msgRenew(sender, payload) {
    return {
      typeUrl: "/lumen.dns.v1.MsgRenew",
      value: MsgRenew.fromPartial({
        creator: sender,
        domain: payload.domain,
        ext: payload.ext,
        durationDays: payload.durationDays ?? 0
      })
    };
  }
  msgTransfer(sender, payload) {
    return {
      typeUrl: "/lumen.dns.v1.MsgTransfer",
      value: MsgTransfer.fromPartial({
        creator: sender,
        domain: payload.domain,
        ext: payload.ext,
        newOwner: payload.newOwner
      })
    };
  }
  msgBid(sender, payload) {
    return {
      typeUrl: "/lumen.dns.v1.MsgBid",
      value: MsgBid.fromPartial({
        creator: sender,
        domain: payload.domain,
        ext: payload.ext,
        amount: String(payload.amount)
      })
    };
  }
  msgSettle(sender, payload) {
    return {
      typeUrl: "/lumen.dns.v1.MsgSettle",
      value: MsgSettle.fromPartial({
        creator: sender,
        domain: payload.domain,
        ext: payload.ext
      })
    };
  }
  msgCreateDomain(sender, payload) {
    return {
      typeUrl: "/lumen.dns.v1.MsgCreateDomain",
      value: MsgCreateDomain.fromPartial({
        creator: sender,
        index: payload.index,
        name: payload.name,
        owner: payload.owner,
        records: payload.records ?? [],
        expireAt: payload.expireAt ?? 0
      })
    };
  }
  msgUpdateDomain(sender, payload) {
    return {
      typeUrl: "/lumen.dns.v1.MsgUpdateDomain",
      value: MsgUpdateDomain.fromPartial({
        creator: sender,
        index: payload.index,
        name: payload.name,
        owner: payload.owner,
        records: payload.records ?? [],
        expireAt: payload.expireAt ?? 0,
        powNonce: payload.powNonce ?? 0
      })
    };
  }
  msgDeleteDomain(sender, payload) {
    return {
      typeUrl: "/lumen.dns.v1.MsgDeleteDomain",
      value: MsgDeleteDomain.fromPartial({
        creator: sender,
        index: payload.index
      })
    };
  }
  msgCreateAuction(sender, payload) {
    return {
      typeUrl: "/lumen.dns.v1.MsgCreateAuction",
      value: MsgCreateAuction.fromPartial({
        creator: sender,
        index: payload.index,
        name: payload.name,
        start: Number(payload.start),
        end: Number(payload.end),
        highestBid: payload.highestBid ?? "",
        bidder: payload.bidder ?? ""
      })
    };
  }
  msgUpdateAuction(sender, payload) {
    return {
      typeUrl: "/lumen.dns.v1.MsgUpdateAuction",
      value: MsgUpdateAuction.fromPartial({
        creator: sender,
        index: payload.index,
        name: payload.name,
        start: payload.start != null ? Number(payload.start) : void 0,
        end: payload.end != null ? Number(payload.end) : void 0,
        highestBid: payload.highestBid ?? "",
        bidder: payload.bidder ?? ""
      })
    };
  }
  msgDeleteAuction(sender, payload) {
    return {
      typeUrl: "/lumen.dns.v1.MsgDeleteAuction",
      value: MsgDeleteAuction.fromPartial({
        creator: sender,
        index: payload.index
      })
    };
  }
};
function paginationParams(pageKey, limit) {
  const params = {};
  if (pageKey) params["pagination.key"] = pageKey;
  if (limit != null) params["pagination.limit"] = String(limit);
  return params;
}

// src/modules/gateways.ts
var GatewaysModule = class extends BaseModule {
  constructor(restEndpoint) {
    const base = restEndpoint ? joinRest(restEndpoint, "/lumen/gateway/v1") : void 0;
    super(base);
  }
  // ---- Queries -------------------------------------------------------------
  params() {
    return this.get("/params");
  }
  authority() {
    return this.get("/authority");
  }
  moduleAccounts() {
    return this.get("/module_accounts");
  }
  gateways(filters = {}) {
    return this.get("/gateways", pagination(filters.offset, filters.limit));
  }
  gateway(id) {
    return this.get(`/gateways/${encodeURIComponent(String(id))}`);
  }
  contracts(filters = {}) {
    const query = {};
    if (filters.status) query.status = String(filters.status);
    if (filters.client) query.client = String(filters.client);
    if (filters.gatewayId != null) query.gateway_id = String(filters.gatewayId);
    if (filters.offset != null) query.offset = String(filters.offset);
    if (filters.limit != null) query.limit = String(filters.limit);
    return this.get("/contracts", query);
  }
  contract(id) {
    return this.get(`/contracts/${encodeURIComponent(String(id))}`);
  }
  // ---- Tx composers --------------------------------------------------------
  msgUpdateParams(authority, params) {
    return {
      typeUrl: "/lumen.gateway.v1.MsgUpdateParams",
      value: MsgUpdateParams2.fromPartial({ authority, params })
    };
  }
  msgRegisterGateway(operator, payload) {
    return {
      typeUrl: "/lumen.gateway.v1.MsgRegisterGateway",
      value: MsgRegisterGateway.fromPartial({
        operator,
        payout: payload.payout,
        metadata: payload.metadata ?? ""
      })
    };
  }
  msgUpdateGateway(operator, payload) {
    return {
      typeUrl: "/lumen.gateway.v1.MsgUpdateGateway",
      value: MsgUpdateGateway.fromPartial({
        operator,
        gatewayId: Number(payload.gatewayId),
        payout: payload.payout ?? void 0,
        metadata: payload.metadata ?? void 0,
        active: payload.active ?? void 0
      })
    };
  }
  msgCreateContract(client, payload) {
    return {
      typeUrl: "/lumen.gateway.v1.MsgCreateContract",
      value: MsgCreateContract.fromPartial({
        client,
        gatewayId: Number(payload.gatewayId),
        priceUlmn: Number(payload.priceUlmn),
        storageGbPerMonth: Number(payload.storageGbPerMonth),
        networkGbPerMonth: Number(payload.networkGbPerMonth),
        monthsTotal: Number(payload.monthsTotal),
        metadata: payload.metadata ?? ""
      })
    };
  }
  msgClaimPayment(operator, contractId) {
    return {
      typeUrl: "/lumen.gateway.v1.MsgClaimPayment",
      value: MsgClaimPayment.fromPartial({
        operator,
        contractId: Number(contractId)
      })
    };
  }
  msgCancelContract(client, contractId) {
    return {
      typeUrl: "/lumen.gateway.v1.MsgCancelContract",
      value: MsgCancelContract.fromPartial({
        client,
        contractId: Number(contractId)
      })
    };
  }
  msgFinalizeContract(finalizer, contractId) {
    return {
      typeUrl: "/lumen.gateway.v1.MsgFinalizeContract",
      value: MsgFinalizeContract.fromPartial({
        finalizer,
        contractId: Number(contractId)
      })
    };
  }
};
function pagination(offset, limit) {
  const params = {};
  if (offset != null) params.offset = String(offset);
  if (limit != null) params.limit = String(limit);
  return params;
}

// src/modules/releases.ts
var ReleasesModule = class extends BaseModule {
  constructor(restEndpoint) {
    const base = restEndpoint ? joinRest(restEndpoint, "/lumen/release") : void 0;
    super(base);
  }
  // ---- Queries -------------------------------------------------------------
  params() {
    return this.get("/params");
  }
  release(id) {
    return this.get(`/id/${encodeURIComponent(String(id))}`);
  }
  releaseById(id) {
    return this.get(`/release/${encodeURIComponent(String(id))}`);
  }
  releases(filters = {}) {
    const query = {};
    if (filters.page != null) query.page = String(filters.page);
    if (filters.limit != null) query.limit = String(Math.min(200, Math.max(1, filters.limit)));
    return this.get("/releases", query);
  }
  latest() {
    return this.get("/latest");
  }
  latestCanon(filters) {
    if (!filters.channel || !filters.platform || !filters.kind) {
      throw new Error("channel, platform, and kind are required");
    }
    const segments = [
      encodeURIComponent(filters.channel),
      encodeURIComponent(filters.platform),
      encodeURIComponent(filters.kind)
    ];
    return this.get(`/latest/${segments.join("/")}`);
  }
  byVersion(version) {
    return this.get(`/by_version/${encodeURIComponent(version)}`);
  }
  // ---- Tx composers --------------------------------------------------------
  msgPublishRelease(creator, release) {
    return {
      typeUrl: "/lumen.release.v1.MsgPublishRelease",
      value: MsgPublishRelease.fromPartial({ creator, release })
    };
  }
  msgMirrorRelease(creator, payload) {
    return {
      typeUrl: "/lumen.release.v1.MsgMirrorRelease",
      value: MsgMirrorRelease.fromPartial({
        creator,
        id: payload.id,
        artifactIndex: payload.artifactIndex,
        newUrls: payload.newUrls
      })
    };
  }
  msgYankRelease(creator, id) {
    return {
      typeUrl: "/lumen.release.v1.MsgYankRelease",
      value: MsgYankRelease.fromPartial({ creator, id })
    };
  }
  msgSetEmergency(creator, payload) {
    return {
      typeUrl: "/lumen.release.v1.MsgSetEmergency",
      value: MsgSetEmergency.fromPartial({
        creator,
        id: payload.id,
        emergencyOk: payload.emergencyOk,
        emergencyTtl: payload.emergencyTtl ?? 0
      })
    };
  }
  msgValidateRelease(authority, id) {
    return {
      typeUrl: "/lumen.release.v1.MsgValidateRelease",
      value: MsgValidateRelease.fromPartial({ authority, id })
    };
  }
  msgRejectRelease(authority, id) {
    return {
      typeUrl: "/lumen.release.v1.MsgRejectRelease",
      value: MsgRejectRelease.fromPartial({ authority, id })
    };
  }
  msgUpdateParams(authority, params) {
    return {
      typeUrl: "/lumen.release.v1.MsgUpdateParams",
      value: MsgUpdateParams3.fromPartial({ authority, params })
    };
  }
};

// src/modules/tokenomics.ts
var TokenomicsModule = class extends BaseModule {
  constructor(restEndpoint) {
    const base = restEndpoint ? joinRest(restEndpoint, "/lumen/tokenomics/v1") : void 0;
    super(base);
  }
  params() {
    return this.get("/params");
  }
  msgUpdateParams(authority, params) {
    return {
      typeUrl: "/lumen.tokenomics.v1.MsgUpdateParams",
      value: MsgUpdateParams4.fromPartial({ authority, params })
    };
  }
  msgUpdateSlashingDowntimeParams(authority, slashFractionDowntime, downtimeJailDuration) {
    return {
      typeUrl: "/lumen.tokenomics.v1.MsgUpdateSlashingDowntimeParams",
      value: MsgUpdateSlashingDowntimeParams.fromPartial({
        authority,
        slashFractionDowntime,
        downtimeJailDuration
      })
    };
  }
};
var PqcModule = class extends BaseModule {
  constructor(restEndpoint) {
    const base = restEndpoint ? joinRest(restEndpoint, "/lumen/pqc/v1") : void 0;
    super(base);
  }
  account(addr) {
    return this.get(`/accounts/${encodeURIComponent(addr)}`);
  }
  params() {
    return this.get("/params");
  }
  msgLinkAccountPqc(creator, payload) {
    return {
      typeUrl: "/lumen.pqc.v1.MsgLinkAccountPQC",
      value: MsgLinkAccountPQC.fromPartial({
        creator,
        scheme: payload.scheme,
        pubKey: normalizeBytes(payload.pubKey),
        powNonce: payload.powNonce ? normalizeBytes(payload.powNonce) : new Uint8Array()
      })
    };
  }
};
function normalizeBytes(value) {
  if (value instanceof Uint8Array) return value;
  const trimmed = value.trim();
  if (/^[0-9a-f]+$/i.test(trimmed)) return fromHex(trimmed);
  return fromBase64(trimmed);
}
var GovModule = class extends BaseModule {
  constructor(restEndpoint) {
    const base = restEndpoint ? joinRest(restEndpoint, "/cosmos/gov/v1") : void 0;
    super(base);
  }
  params(kind) {
    if (kind) return this.get(`/params/${kind}`);
    return this.get("/params");
  }
  proposal(id) {
    return this.get(`/proposals/${encodeURIComponent(String(id))}`);
  }
  proposals(filters = {}) {
    const query = buildPagination(filters);
    if (filters.status) query.proposal_status = filters.status;
    if (filters.voter) query.voter = filters.voter;
    if (filters.depositor) query.depositor = filters.depositor;
    return this.get("/proposals", query);
  }
  deposits(proposalId, pagination2 = {}) {
    return this.get(`/proposals/${encodeURIComponent(String(proposalId))}/deposits`, buildPagination(pagination2));
  }
  deposit(proposalId, depositor) {
    return this.get(
      `/proposals/${encodeURIComponent(String(proposalId))}/deposits/${encodeURIComponent(depositor)}`
    );
  }
  votes(proposalId, pagination2 = {}) {
    return this.get(`/proposals/${encodeURIComponent(String(proposalId))}/votes`, buildPagination(pagination2));
  }
  vote(proposalId, voter) {
    return this.get(`/proposals/${encodeURIComponent(String(proposalId))}/votes/${encodeURIComponent(voter)}`);
  }
  tallyResult(proposalId) {
    return this.get(`/proposals/${encodeURIComponent(String(proposalId))}/tally`);
  }
  msgSubmitProposal(proposer, payload) {
    return {
      typeUrl: "/cosmos.gov.v1.MsgSubmitProposal",
      value: MsgSubmitProposal.fromPartial({
        proposer,
        messages: payload.messages ?? [],
        initialDeposit: payload.initialDeposit ?? [],
        metadata: payload.metadata ?? "",
        title: payload.title ?? "",
        summary: payload.summary ?? ""
      })
    };
  }
  msgDeposit(depositor, payload) {
    return {
      typeUrl: "/cosmos.gov.v1.MsgDeposit",
      value: MsgDeposit.fromPartial({
        depositor,
        proposalId: toProposalId(payload.proposalId),
        amount: payload.amount.slice()
      })
    };
  }
  msgVote(voter, payload) {
    return {
      typeUrl: "/cosmos.gov.v1.MsgVote",
      value: MsgVote.fromPartial({
        voter,
        proposalId: toProposalId(payload.proposalId),
        option: payload.option
      })
    };
  }
  msgVoteWeighted(voter, payload) {
    return {
      typeUrl: "/cosmos.gov.v1.MsgVoteWeighted",
      value: MsgVoteWeighted.fromPartial({
        voter,
        proposalId: toProposalId(payload.proposalId),
        options: payload.options.slice()
      })
    };
  }
};
function buildPagination(params) {
  const query = {};
  if (params.pageKey) query["pagination.key"] = params.pageKey;
  if (params.limit != null) query["pagination.limit"] = String(params.limit);
  return query;
}
function toProposalId(value) {
  if (typeof value === "bigint") return value;
  if (Long.isLong(value)) return BigInt(value.toString());
  if (typeof value === "string") return BigInt(value);
  return BigInt(value);
}

// src/client/base.ts
var LumenClient = class _LumenClient {
  chainId;
  rpc;
  rest;
  grpc;
  stargate;
  modules = {};
  constructor(chainId, endpoints) {
    this.chainId = chainId;
    this.rpc = endpoints.rpc ?? LUMEN.defaultRpc;
    this.rest = endpoints.rest ?? LUMEN.defaultRest;
    this.grpc = endpoints.grpc ?? LUMEN.defaultGrpc;
  }
  static async connect(endpoints = {}, chainId = LUMEN.chainId) {
    const client = new _LumenClient(chainId, endpoints);
    client.stargate = await StargateClient.connect(client.rpc);
    const gotChain = await client.stargate.getChainId();
    if (gotChain !== chainId) console.warn(`Connected to chainId=${gotChain}, expected=${chainId}`);
    return client;
  }
  ensureStargate() {
    if (!this.stargate) throw new Error("Not connected. Call LumenClient.connect first.");
    return this.stargate;
  }
  async disconnect() {
    if (this.stargate) {
      await this.stargate.disconnect();
      this.stargate = void 0;
    }
  }
  async getHeight() {
    return this.ensureStargate().getHeight();
  }
  async getBalance(address, denom = "ulmn") {
    return this.ensureStargate().getBalance(address, denom);
  }
  onNewBlock(callback, intervalMs = 1e3) {
    let lastHeight = -1;
    const timer = setInterval(async () => {
      try {
        const h = await this.getHeight();
        if (h !== lastHeight) {
          lastHeight = h;
          callback(h);
        }
      } catch {
      }
    }, intervalMs);
    return () => clearInterval(timer);
  }
  dns() {
    if (!this.modules.dns) this.modules.dns = new DnsModule(this.rest);
    return this.modules.dns;
  }
  gateways() {
    if (!this.modules.gateways) this.modules.gateways = new GatewaysModule(this.rest);
    return this.modules.gateways;
  }
  releases() {
    if (!this.modules.releases) this.modules.releases = new ReleasesModule(this.rest);
    return this.modules.releases;
  }
  tokenomics() {
    if (!this.modules.tokenomics) this.modules.tokenomics = new TokenomicsModule(this.rest);
    return this.modules.tokenomics;
  }
  gov() {
    if (!this.modules.gov) this.modules.gov = new GovModule(this.rest);
    return this.modules.gov;
  }
  pqc() {
    if (!this.modules.pqc) this.modules.pqc = new PqcModule(this.rest);
    return this.modules.pqc;
  }
};

// src/utils/gas.ts
var gas_exports = {};
__export(gas_exports, {
  isGaslessTx: () => isGaslessTx,
  zeroFee: () => zeroFee
});
var GASLESS_SET = new Set(LUMEN.gaslessTypeUrls);
function isGaslessTx(msgs) {
  if (!Array.isArray(msgs) || msgs.length === 0) return false;
  for (const msg2 of msgs) {
    if (!msg2?.typeUrl || !GASLESS_SET.has(msg2.typeUrl)) return false;
  }
  return true;
}
function zeroFee(gas = "250000") {
  return { amount: [], gas: String(gas) };
}

// src/pqc/tx.ts
init_constants();
function createBasePQCSignatureEntry() {
  return { addr: "", scheme: "", signature: new Uint8Array(0), pubKey: new Uint8Array(0) };
}
var PQCSignatureEntry = {
  encode(message, writer = new BinaryWriter()) {
    if (message.addr !== "") {
      writer.uint32(10).string(message.addr);
    }
    if (message.scheme !== "") {
      writer.uint32(18).string(message.scheme);
    }
    if (message.signature.length !== 0) {
      writer.uint32(26).bytes(message.signature);
    }
    if (message.pubKey.length !== 0) {
      writer.uint32(34).bytes(message.pubKey);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBasePQCSignatureEntry();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.addr = reader.string();
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }
          message.scheme = reader.string();
          continue;
        }
        case 3: {
          if (tag !== 26) {
            break;
          }
          message.signature = reader.bytes();
          continue;
        }
        case 4: {
          if (tag !== 34) {
            break;
          }
          message.pubKey = reader.bytes();
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      addr: isSet13(object.addr) ? globalThis.String(object.addr) : "",
      scheme: isSet13(object.scheme) ? globalThis.String(object.scheme) : "",
      signature: isSet13(object.signature) ? bytesFromBase643(object.signature) : new Uint8Array(0),
      pubKey: isSet13(object.pubKey) ? bytesFromBase643(object.pubKey) : new Uint8Array(0)
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.addr !== "") {
      obj.addr = message.addr;
    }
    if (message.scheme !== "") {
      obj.scheme = message.scheme;
    }
    if (message.signature.length !== 0) {
      obj.signature = base64FromBytes3(message.signature);
    }
    if (message.pubKey.length !== 0) {
      obj.pubKey = base64FromBytes3(message.pubKey);
    }
    return obj;
  },
  create(base) {
    return PQCSignatureEntry.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBasePQCSignatureEntry();
    message.addr = object.addr ?? "";
    message.scheme = object.scheme ?? "";
    message.signature = object.signature ?? new Uint8Array(0);
    message.pubKey = object.pubKey ?? new Uint8Array(0);
    return message;
  }
};
function createBasePQCSignatures() {
  return { signatures: [] };
}
var PQCSignatures = {
  encode(message, writer = new BinaryWriter()) {
    for (const v of message.signatures) {
      PQCSignatureEntry.encode(v, writer.uint32(10).fork()).join();
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === void 0 ? reader.len : reader.pos + length;
    const message = createBasePQCSignatures();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }
          message.signatures.push(PQCSignatureEntry.decode(reader, reader.uint32()));
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },
  fromJSON(object) {
    return {
      signatures: globalThis.Array.isArray(object?.signatures) ? object.signatures.map((e) => PQCSignatureEntry.fromJSON(e)) : []
    };
  },
  toJSON(message) {
    const obj = {};
    if (message.signatures?.length) {
      obj.signatures = message.signatures.map((e) => PQCSignatureEntry.toJSON(e));
    }
    return obj;
  },
  create(base) {
    return PQCSignatures.fromPartial(base ?? {});
  },
  fromPartial(object) {
    const message = createBasePQCSignatures();
    message.signatures = object.signatures?.map((e) => PQCSignatureEntry.fromPartial(e)) || [];
    return message;
  }
};
function bytesFromBase643(b64) {
  if (globalThis.Buffer) {
    return Uint8Array.from(globalThis.Buffer.from(b64, "base64"));
  } else {
    const bin = globalThis.atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; ++i) {
      arr[i] = bin.charCodeAt(i);
    }
    return arr;
  }
}
function base64FromBytes3(arr) {
  if (globalThis.Buffer) {
    return globalThis.Buffer.from(arr).toString("base64");
  } else {
    const bin = [];
    arr.forEach((byte) => {
      bin.push(globalThis.String.fromCharCode(byte));
    });
    return globalThis.btoa(bin.join(""));
  }
}
function isSet13(value) {
  return value !== null && value !== void 0;
}

// src/pqc/tx.ts
function sanitizeBodyBytes(bodyBytes) {
  if (!bodyBytes?.length) throw new Error("tx body bytes missing");
  const body = TxBody.decode(bodyBytes);
  body.extensionOptions = filterExtensions(body.extensionOptions ?? []);
  body.nonCriticalExtensionOptions = filterExtensions(body.nonCriticalExtensionOptions ?? []);
  return TxBody.encode(body).finish();
}
function computeSignBytes(chainId, accountNumber, txRaw) {
  if (!txRaw.bodyBytes?.length || !txRaw.authInfoBytes?.length) {
    throw new Error("tx raw missing body or auth info bytes");
  }
  const sanitized = sanitizeBodyBytes(txRaw.bodyBytes);
  const doc = SignDoc.fromPartial({
    bodyBytes: sanitized,
    authInfoBytes: txRaw.authInfoBytes,
    chainId,
    accountNumber: BigInt(accountNumber)
  });
  const docBytes = SignDoc.encode(doc).finish();
  return concatPrefix(docBytes);
}
function withPqcExtension(bodyBytes, entries) {
  const body = TxBody.decode(bodyBytes);
  body.extensionOptions = filterExtensions(body.extensionOptions ?? []);
  body.nonCriticalExtensionOptions = filterExtensions(body.nonCriticalExtensionOptions ?? []);
  if (entries.length > 0) {
    const payload = PQCSignatures.fromPartial({ signatures: entries });
    const packet = Any.fromPartial({
      typeUrl: PQC_TYPE_URL,
      value: PQCSignatures.encode(payload).finish()
    });
    body.nonCriticalExtensionOptions.push(packet);
  }
  return TxBody.encode(body).finish();
}
function filterExtensions(options) {
  return options.filter((entry) => entry?.typeUrl !== PQC_TYPE_URL);
}
function concatPrefix(docBytes) {
  const prefixBytes = new TextEncoder().encode(PQC_PREFIX);
  const out = new Uint8Array(prefixBytes.length + docBytes.length);
  out.set(prefixBytes, 0);
  out.set(docBytes, prefixBytes.length);
  return out;
}

// src/pqc/wasm_exec.js
(() => {
  if (typeof globalThis.__dirname === "string") return globalThis.__dirname;
  try {
    const resolved = typeof import.meta !== "undefined" ? new URL(".", import.meta.url).pathname : ".";
    globalThis.__dirname = resolved;
    return resolved;
  } catch {
    globalThis.__dirname = ".";
    return ".";
  }
})();
var Go = (() => {
  const enosys = () => {
    const err = new Error("not implemented");
    err.code = "ENOSYS";
    return err;
  };
  if (!globalThis.fs) {
    let outputBuf = "";
    globalThis.fs = {
      constants: { O_WRONLY: -1, O_RDWR: -1, O_CREAT: -1, O_TRUNC: -1, O_APPEND: -1, O_EXCL: -1, O_DIRECTORY: -1 },
      // unused
      writeSync(fd, buf) {
        outputBuf += decoder.decode(buf);
        const nl = outputBuf.lastIndexOf("\n");
        if (nl != -1) {
          console.log(outputBuf.substring(0, nl));
          outputBuf = outputBuf.substring(nl + 1);
        }
        return buf.length;
      },
      write(fd, buf, offset, length, position, callback) {
        if (offset !== 0 || length !== buf.length || position !== null) {
          callback(enosys());
          return;
        }
        const n = this.writeSync(fd, buf);
        callback(null, n);
      },
      chmod(path2, mode, callback) {
        callback(enosys());
      },
      chown(path2, uid, gid, callback) {
        callback(enosys());
      },
      close(fd, callback) {
        callback(enosys());
      },
      fchmod(fd, mode, callback) {
        callback(enosys());
      },
      fchown(fd, uid, gid, callback) {
        callback(enosys());
      },
      fstat(fd, callback) {
        callback(enosys());
      },
      fsync(fd, callback) {
        callback(null);
      },
      ftruncate(fd, length, callback) {
        callback(enosys());
      },
      lchown(path2, uid, gid, callback) {
        callback(enosys());
      },
      link(path2, link, callback) {
        callback(enosys());
      },
      lstat(path2, callback) {
        callback(enosys());
      },
      mkdir(path2, perm, callback) {
        callback(enosys());
      },
      open(path2, flags, mode, callback) {
        callback(enosys());
      },
      read(fd, buffer, offset, length, position, callback) {
        callback(enosys());
      },
      readdir(path2, callback) {
        callback(enosys());
      },
      readlink(path2, callback) {
        callback(enosys());
      },
      rename(from, to, callback) {
        callback(enosys());
      },
      rmdir(path2, callback) {
        callback(enosys());
      },
      stat(path2, callback) {
        callback(enosys());
      },
      symlink(path2, link, callback) {
        callback(enosys());
      },
      truncate(path2, length, callback) {
        callback(enosys());
      },
      unlink(path2, callback) {
        callback(enosys());
      },
      utimes(path2, atime, mtime, callback) {
        callback(enosys());
      }
    };
  }
  if (!globalThis.process) {
    globalThis.process = {
      getuid() {
        return -1;
      },
      getgid() {
        return -1;
      },
      geteuid() {
        return -1;
      },
      getegid() {
        return -1;
      },
      getgroups() {
        throw enosys();
      },
      pid: -1,
      ppid: -1,
      umask() {
        throw enosys();
      },
      cwd() {
        throw enosys();
      },
      chdir() {
        throw enosys();
      }
    };
  }
  if (!globalThis.path) {
    globalThis.path = {
      resolve(...pathSegments) {
        return pathSegments.join("/");
      }
    };
  }
  if (!globalThis.crypto) {
    throw new Error("globalThis.crypto is not available, polyfill required (crypto.getRandomValues only)");
  }
  if (!globalThis.performance) {
    throw new Error("globalThis.performance is not available, polyfill required (performance.now only)");
  }
  if (!globalThis.TextEncoder) {
    throw new Error("globalThis.TextEncoder is not available, polyfill required");
  }
  if (!globalThis.TextDecoder) {
    throw new Error("globalThis.TextDecoder is not available, polyfill required");
  }
  const encoder = new TextEncoder("utf-8");
  const decoder = new TextDecoder("utf-8");
  class GoRuntime {
    constructor() {
      this.argv = ["js"];
      this.env = {};
      this.exit = (code) => {
        if (code !== 0) {
          console.warn("exit code:", code);
        }
      };
      this._exitPromise = new Promise((resolve) => {
        this._resolveExitPromise = resolve;
      });
      this._pendingEvent = null;
      this._scheduledTimeouts = /* @__PURE__ */ new Map();
      this._nextCallbackTimeoutID = 1;
      const setInt64 = (addr, v) => {
        this.mem.setUint32(addr + 0, v, true);
        this.mem.setUint32(addr + 4, Math.floor(v / 4294967296), true);
      };
      const getInt64 = (addr) => {
        const low = this.mem.getUint32(addr + 0, true);
        const high = this.mem.getInt32(addr + 4, true);
        return low + high * 4294967296;
      };
      const loadValue = (addr) => {
        const f = this.mem.getFloat64(addr, true);
        if (f === 0) {
          return void 0;
        }
        if (!isNaN(f)) {
          return f;
        }
        const id = this.mem.getUint32(addr, true);
        return this._values[id];
      };
      const storeValue = (addr, v) => {
        const nanHead = 2146959360;
        if (typeof v === "number" && v !== 0) {
          if (isNaN(v)) {
            this.mem.setUint32(addr + 4, nanHead, true);
            this.mem.setUint32(addr, 0, true);
            return;
          }
          this.mem.setFloat64(addr, v, true);
          return;
        }
        if (v === void 0) {
          this.mem.setFloat64(addr, 0, true);
          return;
        }
        let id = this._ids.get(v);
        if (id === void 0) {
          id = this._idPool.pop();
          if (id === void 0) {
            id = this._values.length;
          }
          this._values[id] = v;
          this._goRefCounts[id] = 0;
          this._ids.set(v, id);
        }
        this._goRefCounts[id]++;
        let typeFlag = 0;
        switch (typeof v) {
          case "object":
            if (v !== null) {
              typeFlag = 1;
            }
            break;
          case "string":
            typeFlag = 2;
            break;
          case "symbol":
            typeFlag = 3;
            break;
          case "function":
            typeFlag = 4;
            break;
        }
        this.mem.setUint32(addr + 4, nanHead | typeFlag, true);
        this.mem.setUint32(addr, id, true);
      };
      const loadSlice = (addr) => {
        const array = getInt64(addr + 0);
        const len = getInt64(addr + 8);
        return new Uint8Array(this._inst.exports.mem.buffer, array, len);
      };
      const loadSliceOfValues = (addr) => {
        const array = getInt64(addr + 0);
        const len = getInt64(addr + 8);
        const a = new Array(len);
        for (let i = 0; i < len; i++) {
          a[i] = loadValue(array + i * 8);
        }
        return a;
      };
      const loadString = (addr) => {
        const saddr = getInt64(addr + 0);
        const len = getInt64(addr + 8);
        return decoder.decode(new DataView(this._inst.exports.mem.buffer, saddr, len));
      };
      const testCallExport = (a, b) => {
        this._inst.exports.testExport0();
        return this._inst.exports.testExport(a, b);
      };
      const timeOrigin = Date.now() - performance.now();
      this.importObject = {
        _gotest: {
          add: (a, b) => a + b,
          callExport: testCallExport
        },
        gojs: {
          // Go's SP does not change as long as no Go code is running. Some operations (e.g. calls, getters and setters)
          // may synchronously trigger a Go event handler. This makes Go code get executed in the middle of the imported
          // function. A goroutine can switch to a new stack if the current stack is too small (see morestack function).
          // This changes the SP, thus we have to update the SP used by the imported function.
          // func wasmExit(code int32)
          "runtime.wasmExit": (sp) => {
            sp >>>= 0;
            const code = this.mem.getInt32(sp + 8, true);
            this.exited = true;
            delete this._inst;
            delete this._values;
            delete this._goRefCounts;
            delete this._ids;
            delete this._idPool;
            this.exit(code);
          },
          // func wasmWrite(fd uintptr, p unsafe.Pointer, n int32)
          "runtime.wasmWrite": (sp) => {
            sp >>>= 0;
            const fd = getInt64(sp + 8);
            const p = getInt64(sp + 16);
            const n = this.mem.getInt32(sp + 24, true);
            fs.writeSync(fd, new Uint8Array(this._inst.exports.mem.buffer, p, n));
          },
          // func resetMemoryDataView()
          "runtime.resetMemoryDataView": (sp) => {
            this.mem = new DataView(this._inst.exports.mem.buffer);
          },
          // func nanotime1() int64
          "runtime.nanotime1": (sp) => {
            sp >>>= 0;
            setInt64(sp + 8, (timeOrigin + performance.now()) * 1e6);
          },
          // func walltime() (sec int64, nsec int32)
          "runtime.walltime": (sp) => {
            sp >>>= 0;
            const msec = (/* @__PURE__ */ new Date()).getTime();
            setInt64(sp + 8, msec / 1e3);
            this.mem.setInt32(sp + 16, msec % 1e3 * 1e6, true);
          },
          // func scheduleTimeoutEvent(delay int64) int32
          "runtime.scheduleTimeoutEvent": (sp) => {
            sp >>>= 0;
            const id = this._nextCallbackTimeoutID;
            this._nextCallbackTimeoutID++;
            this._scheduledTimeouts.set(id, setTimeout(
              () => {
                this._resume();
                while (this._scheduledTimeouts.has(id)) {
                  console.warn("scheduleTimeoutEvent: missed timeout event");
                  this._resume();
                }
              },
              getInt64(sp + 8)
            ));
            this.mem.setInt32(sp + 16, id, true);
          },
          // func clearTimeoutEvent(id int32)
          "runtime.clearTimeoutEvent": (sp) => {
            sp >>>= 0;
            const id = this.mem.getInt32(sp + 8, true);
            clearTimeout(this._scheduledTimeouts.get(id));
            this._scheduledTimeouts.delete(id);
          },
          // func getRandomData(r []byte)
          "runtime.getRandomData": (sp) => {
            sp >>>= 0;
            crypto.getRandomValues(loadSlice(sp + 8));
          },
          // func finalizeRef(v ref)
          "syscall/js.finalizeRef": (sp) => {
            sp >>>= 0;
            const id = this.mem.getUint32(sp + 8, true);
            this._goRefCounts[id]--;
            if (this._goRefCounts[id] === 0) {
              const v = this._values[id];
              this._values[id] = null;
              this._ids.delete(v);
              this._idPool.push(id);
            }
          },
          // func stringVal(value string) ref
          "syscall/js.stringVal": (sp) => {
            sp >>>= 0;
            storeValue(sp + 24, loadString(sp + 8));
          },
          // func valueGet(v ref, p string) ref
          "syscall/js.valueGet": (sp) => {
            sp >>>= 0;
            const result = Reflect.get(loadValue(sp + 8), loadString(sp + 16));
            sp = this._inst.exports.getsp() >>> 0;
            storeValue(sp + 32, result);
          },
          // func valueSet(v ref, p string, x ref)
          "syscall/js.valueSet": (sp) => {
            sp >>>= 0;
            Reflect.set(loadValue(sp + 8), loadString(sp + 16), loadValue(sp + 32));
          },
          // func valueDelete(v ref, p string)
          "syscall/js.valueDelete": (sp) => {
            sp >>>= 0;
            Reflect.deleteProperty(loadValue(sp + 8), loadString(sp + 16));
          },
          // func valueIndex(v ref, i int) ref
          "syscall/js.valueIndex": (sp) => {
            sp >>>= 0;
            storeValue(sp + 24, Reflect.get(loadValue(sp + 8), getInt64(sp + 16)));
          },
          // valueSetIndex(v ref, i int, x ref)
          "syscall/js.valueSetIndex": (sp) => {
            sp >>>= 0;
            Reflect.set(loadValue(sp + 8), getInt64(sp + 16), loadValue(sp + 24));
          },
          // func valueCall(v ref, m string, args []ref) (ref, bool)
          "syscall/js.valueCall": (sp) => {
            sp >>>= 0;
            try {
              const v = loadValue(sp + 8);
              const m = Reflect.get(v, loadString(sp + 16));
              const args = loadSliceOfValues(sp + 32);
              const result = Reflect.apply(m, v, args);
              sp = this._inst.exports.getsp() >>> 0;
              storeValue(sp + 56, result);
              this.mem.setUint8(sp + 64, 1);
            } catch (err) {
              sp = this._inst.exports.getsp() >>> 0;
              storeValue(sp + 56, err);
              this.mem.setUint8(sp + 64, 0);
            }
          },
          // func valueInvoke(v ref, args []ref) (ref, bool)
          "syscall/js.valueInvoke": (sp) => {
            sp >>>= 0;
            try {
              const v = loadValue(sp + 8);
              const args = loadSliceOfValues(sp + 16);
              const result = Reflect.apply(v, void 0, args);
              sp = this._inst.exports.getsp() >>> 0;
              storeValue(sp + 40, result);
              this.mem.setUint8(sp + 48, 1);
            } catch (err) {
              sp = this._inst.exports.getsp() >>> 0;
              storeValue(sp + 40, err);
              this.mem.setUint8(sp + 48, 0);
            }
          },
          // func valueNew(v ref, args []ref) (ref, bool)
          "syscall/js.valueNew": (sp) => {
            sp >>>= 0;
            try {
              const v = loadValue(sp + 8);
              const args = loadSliceOfValues(sp + 16);
              const result = Reflect.construct(v, args);
              sp = this._inst.exports.getsp() >>> 0;
              storeValue(sp + 40, result);
              this.mem.setUint8(sp + 48, 1);
            } catch (err) {
              sp = this._inst.exports.getsp() >>> 0;
              storeValue(sp + 40, err);
              this.mem.setUint8(sp + 48, 0);
            }
          },
          // func valueLength(v ref) int
          "syscall/js.valueLength": (sp) => {
            sp >>>= 0;
            setInt64(sp + 16, parseInt(loadValue(sp + 8).length));
          },
          // valuePrepareString(v ref) (ref, int)
          "syscall/js.valuePrepareString": (sp) => {
            sp >>>= 0;
            const str = encoder.encode(String(loadValue(sp + 8)));
            storeValue(sp + 16, str);
            setInt64(sp + 24, str.length);
          },
          // valueLoadString(v ref, b []byte)
          "syscall/js.valueLoadString": (sp) => {
            sp >>>= 0;
            const str = loadValue(sp + 8);
            loadSlice(sp + 16).set(str);
          },
          // func valueInstanceOf(v ref, t ref) bool
          "syscall/js.valueInstanceOf": (sp) => {
            sp >>>= 0;
            this.mem.setUint8(sp + 24, loadValue(sp + 8) instanceof loadValue(sp + 16) ? 1 : 0);
          },
          // func copyBytesToGo(dst []byte, src ref) (int, bool)
          "syscall/js.copyBytesToGo": (sp) => {
            sp >>>= 0;
            const dst = loadSlice(sp + 8);
            const src = loadValue(sp + 32);
            if (!(src instanceof Uint8Array || src instanceof Uint8ClampedArray)) {
              this.mem.setUint8(sp + 48, 0);
              return;
            }
            const toCopy = src.subarray(0, dst.length);
            dst.set(toCopy);
            setInt64(sp + 40, toCopy.length);
            this.mem.setUint8(sp + 48, 1);
          },
          // func copyBytesToJS(dst ref, src []byte) (int, bool)
          "syscall/js.copyBytesToJS": (sp) => {
            sp >>>= 0;
            const dst = loadValue(sp + 8);
            const src = loadSlice(sp + 16);
            if (!(dst instanceof Uint8Array || dst instanceof Uint8ClampedArray)) {
              this.mem.setUint8(sp + 48, 0);
              return;
            }
            const toCopy = src.subarray(0, dst.length);
            dst.set(toCopy);
            setInt64(sp + 40, toCopy.length);
            this.mem.setUint8(sp + 48, 1);
          },
          "debug": (value) => {
            console.log(value);
          }
        }
      };
    }
    async run(instance) {
      if (!(instance instanceof WebAssembly.Instance)) {
        throw new Error("Go.run: WebAssembly.Instance expected");
      }
      this._inst = instance;
      this.mem = new DataView(this._inst.exports.mem.buffer);
      this._values = [
        // JS values that Go currently has references to, indexed by reference id
        NaN,
        0,
        null,
        true,
        false,
        globalThis,
        this
      ];
      this._goRefCounts = new Array(this._values.length).fill(Infinity);
      this._ids = /* @__PURE__ */ new Map([
        // mapping from JS values to reference ids
        [0, 1],
        [null, 2],
        [true, 3],
        [false, 4],
        [globalThis, 5],
        [this, 6]
      ]);
      this._idPool = [];
      this.exited = false;
      let offset = 4096;
      const strPtr = (str) => {
        const ptr = offset;
        const bytes = encoder.encode(str + "\0");
        new Uint8Array(this.mem.buffer, offset, bytes.length).set(bytes);
        offset += bytes.length;
        if (offset % 8 !== 0) {
          offset += 8 - offset % 8;
        }
        return ptr;
      };
      const argc = this.argv.length;
      const argvPtrs = [];
      this.argv.forEach((arg) => {
        argvPtrs.push(strPtr(arg));
      });
      argvPtrs.push(0);
      const keys = Object.keys(this.env).sort();
      keys.forEach((key) => {
        argvPtrs.push(strPtr(`${key}=${this.env[key]}`));
      });
      argvPtrs.push(0);
      const argv = offset;
      argvPtrs.forEach((ptr) => {
        this.mem.setUint32(offset, ptr, true);
        this.mem.setUint32(offset + 4, 0, true);
        offset += 8;
      });
      const wasmMinDataAddr = 4096 + 8192;
      if (offset >= wasmMinDataAddr) {
        throw new Error("total length of command line and environment variables exceeds limit");
      }
      this._inst.exports.run(argc, argv);
      if (this.exited) {
        this._resolveExitPromise();
      }
      await this._exitPromise;
    }
    _resume() {
      if (this.exited) {
        throw new Error("Go program has already exited");
      }
      this._inst.exports.resume();
      if (this.exited) {
        this._resolveExitPromise();
      }
    }
    _makeFuncWrapper(id) {
      const go = this;
      return function() {
        const event = { id, this: this, args: arguments };
        go._pendingEvent = event;
        go._resume();
        return event.result;
      };
    }
  }
  globalThis.Go = GoRuntime;
  return GoRuntime;
})();
var wasmUrl = new URL("./dilithium3.wasm", import.meta.url);
var globalAny = globalThis;
var initPromise = null;
async function ensureWasm() {
  if (globalAny.__lumen_dilithium_ready__) return;
  if (!initPromise) {
    initPromise = (async () => {
      const go = new Go();
      const wasmPath = fileURLToPath(wasmUrl);
      const wasmBytes = await promises.readFile(path.resolve(wasmPath));
      const { instance } = await WebAssembly.instantiate(wasmBytes, go.importObject);
      go.run(instance);
      await waitFor(() => typeof globalAny.lumen_dilithium_sign === "function");
      globalAny.__lumen_dilithium_ready__ = true;
    })();
  }
  await initPromise;
}
function waitFor(check, interval = 10) {
  return new Promise((resolve) => {
    const poll = () => {
      if (check()) {
        resolve();
        return;
      }
      setTimeout(poll, interval);
    };
    poll();
  });
}
function cloneBytes(value) {
  return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
}
async function wasmKeygen() {
  await ensureWasm();
  const result = globalAny.lumen_dilithium_keygen();
  return {
    publicKey: cloneBytes(result.publicKey),
    privateKey: cloneBytes(result.privateKey)
  };
}
async function wasmSign(priv, msg2) {
  await ensureWasm();
  const result = globalAny.lumen_dilithium_sign(priv, msg2);
  return cloneBytes(result);
}

// src/pqc/signer.ts
async function createKeyPair() {
  return wasmKeygen();
}
async function sign(payload, privateKey) {
  return wasmSign(privateKey, payload);
}

// src/client/signing.ts
init_constants();

// src/types/lumen/pqc/v1/params.ts
function pqcPolicyFromJSON(object) {
  switch (object) {
    case 0:
    case "PQC_POLICY_DISABLED":
      return 0 /* PQC_POLICY_DISABLED */;
    case 1:
    case "PQC_POLICY_OPTIONAL":
      return 1 /* PQC_POLICY_OPTIONAL */;
    case 2:
    case "PQC_POLICY_REQUIRED":
      return 2 /* PQC_POLICY_REQUIRED */;
    case -1:
    case "UNRECOGNIZED":
    default:
      return -1 /* UNRECOGNIZED */;
  }
}

// src/client/signing.ts
var LumenSigningClient = class _LumenSigningClient extends LumenClient {
  signing;
  signer;
  registry;
  gasPrice;
  gasMultiplier;
  pqcConfig;
  pqcStore;
  pqcParams;
  pqcParamsFetched = false;
  constructor(chainId, endpoints, signer, registry, options) {
    super(chainId, endpoints);
    this.signer = signer;
    this.registry = registry;
    this.gasPrice = options.gasPrice;
    this.gasMultiplier = options.gasMultiplier ?? 1.3;
    this.pqcConfig = {
      enabled: options.pqc?.enabled ?? true,
      scheme: options.pqc?.scheme ?? DEFAULT_SCHEME,
      store: options.pqc?.store,
      homeDir: options.pqc?.homeDir,
      overrides: options.pqc?.overrides ?? {}
    };
    if (this.pqcConfig.store) this.pqcStore = this.pqcConfig.store;
  }
  static async connectWithSigner(signer, endpoints = {}, chainId = LUMEN.chainId, options = {}) {
    const { gasMultiplier, pqc, ...cosmjsOptions } = options;
    const registry = cosmjsOptions.registry ?? createRegistry();
    cosmjsOptions.registry = registry;
    const client = new _LumenSigningClient(chainId, endpoints, signer, registry, {
      ...cosmjsOptions,
      gasMultiplier,
      pqc
    });
    client.signing = await SigningStargateClient.connectWithSigner(client.rpc, signer, cosmjsOptions);
    client.stargate = client.signing;
    const gotChain = await client.signing.getChainId();
    if (gotChain !== chainId) console.warn(`Connected to chainId=${gotChain}, expected=${chainId}`);
    return client;
  }
  ensureSigning() {
    if (!this.signing) throw new Error("Signing client not initialised. Use connectWithSigner.");
    return this.signing;
  }
  async signAndBroadcast(signerAddress, messages, fee = "auto", memo = "", timeoutHeight) {
    const signing = this.ensureSigning();
    const directFee = isStdFee(fee) ? fee : void 0;
    const usedFee = directFee ?? await this.normalizeFee(signerAddress, messages, fee, memo);
    const initialTx = await signing.sign(signerAddress, messages, usedFee, memo, void 0, timeoutHeight);
    const pqcEntries = await this.buildPqcEntries(initialTx, signerAddress);
    const finalTx = pqcEntries.length > 0 ? await this.resignWithPqc(initialTx, pqcEntries, signerAddress) : initialTx;
    const txBytes = TxRaw.encode(finalTx).finish();
    return signing.broadcastTx(txBytes);
  }
  async normalizeFee(signerAddress, messages, fee, memo) {
    if (isStdFee(fee)) return fee;
    if (isGaslessTx(messages)) return zeroFee();
    const signing = this.ensureSigning();
    if (fee === "auto" || typeof fee === "number") {
      if (!this.gasPrice) throw new Error("gasPrice must be set when using auto fee estimation");
      const gasEstimation = await signing.simulate(signerAddress, messages, memo);
      const multiplier = typeof fee === "number" ? fee : this.gasMultiplier;
      return calculateFee(Math.round(gasEstimation * multiplier), this.gasPrice);
    }
    return fee;
  }
  async buildPqcEntries(txRaw, signerAddress) {
    if (!this.pqcConfig.enabled) return [];
    const store = await this.ensurePqcStore();
    if (!store) return [];
    const overrides = this.pqcConfig.overrides ?? {};
    const keyName = overrides[signerAddress] ?? store.getLink(signerAddress);
    const params = await this.loadPqcParams();
    const required = params ? params.policy === 2 /* PQC_POLICY_REQUIRED */ : true;
    if (!keyName) {
      if (required) throw new Error(`No PQC key linked to ${signerAddress}. Import and link a Dilithium key first.`);
      return [];
    }
    const key = store.getKey(keyName);
    if (!key) throw new Error(`PQC key "${keyName}" not found in local store`);
    const scheme = (this.pqcConfig.scheme ?? key.scheme).toLowerCase();
    if (key.scheme.toLowerCase() !== scheme) {
      throw new Error(`Local PQC key ${key.name} uses scheme ${key.scheme}, expected ${scheme}`);
    }
    validateKeyShape(key, scheme);
    const registry = await this.fetchPqcAccount(signerAddress);
    if (registry?.scheme && registry.scheme.toLowerCase() !== scheme) {
      throw new Error(`On-chain PQC registry expects scheme ${registry.scheme} for ${signerAddress}`);
    }
    if (params?.minScheme && params.minScheme.toLowerCase() !== scheme) {
      throw new Error(`Chain requires minimum scheme ${params.minScheme}, local config uses ${scheme}`);
    }
    const { accountNumber } = await this.ensureSigning().getSequence(signerAddress);
    const signBytes = computeSignBytes(this.chainId, accountNumber, txRaw);
    const signature = await sign(signBytes, key.privateKey);
    return [{
      addr: signerAddress,
      scheme,
      signature,
      pubKey: key.publicKey
    }];
  }
  async resignWithPqc(txRaw, entries, signerAddress) {
    if (!("signDirect" in this.signer)) {
      throw new Error("PQC signing requires a Direct signer (OfflineDirectSigner)");
    }
    const direct = this.signer;
    const nextBody = withPqcExtension(txRaw.bodyBytes, entries);
    const { accountNumber } = await this.ensureSigning().getSequence(signerAddress);
    const signDoc = makeSignDoc(nextBody, txRaw.authInfoBytes, this.chainId, accountNumber);
    const { signature, signed } = await direct.signDirect(signerAddress, signDoc);
    return TxRaw.fromPartial({
      bodyBytes: signed.bodyBytes,
      authInfoBytes: signed.authInfoBytes,
      signatures: [fromBase64(signature.signature)]
    });
  }
  async ensurePqcStore() {
    if (!this.pqcConfig.enabled) return void 0;
    if (this.pqcStore) return this.pqcStore;
    if (this.pqcConfig.store) {
      this.pqcStore = this.pqcConfig.store;
      return this.pqcStore;
    }
    const mod = await Promise.resolve().then(() => (init_keystore(), keystore_exports));
    const home = this.pqcConfig.homeDir ?? mod.defaultHomeDir();
    this.pqcStore = await mod.PqcKeyStore.open(home);
    return this.pqcStore;
  }
  async loadPqcParams() {
    if (this.pqcParamsFetched) return this.pqcParams;
    this.pqcParamsFetched = true;
    try {
      const payload = await this.pqc().params();
      const params = parseParams(payload?.params ?? payload);
      this.pqcParams = params;
    } catch {
      this.pqcParams = void 0;
    }
    return this.pqcParams;
  }
  async fetchPqcAccount(address) {
    try {
      const payload = await this.pqc().account(address);
      return payload?.account ?? payload;
    } catch {
      return void 0;
    }
  }
};
function validateKeyShape(key, scheme) {
  if (scheme === DEFAULT_SCHEME) {
    const pubLen = key.publicKey.length;
    const privLen = key.privateKey.length;
    if (pubLen !== DILITHIUM3_PUBLIC_KEY_BYTES || privLen !== DILITHIUM3_PRIVATE_KEY_BYTES) {
      throw new Error(
        `PQC key "${key.name}" is incompatible with Dilithium3 (${pubLen}/${privLen} bytes, expected ${DILITHIUM3_PUBLIC_KEY_BYTES}/${DILITHIUM3_PRIVATE_KEY_BYTES}). Re-import or regenerate the key using @lumen-chain/sdk >= 0.9.0.`
      );
    }
  }
}
function isStdFee(value) {
  return typeof value === "object" && value !== null && "gas" in value;
}
function parseParams(input) {
  if (!input) return void 0;
  const policy = typeof input.policy === "string" ? pqcPolicyFromJSON(input.policy) : Number(input.policy ?? 0);
  return {
    policy,
    minScheme: input.minScheme ?? input.min_scheme ?? "",
    minBalanceForLink: input.minBalanceForLink ?? input.min_balance_for_link,
    powDifficultyBits: Number(input.powDifficultyBits ?? input.pow_difficulty_bits ?? 0)
  };
}

// src/sdk.ts
var LumenSDK = class _LumenSDK {
  constructor(client) {
    this.client = client;
  }
  static async connectWithSigner(signer, endpoints, options) {
    const client = await LumenSigningClient.connectWithSigner(signer, endpoints, void 0, options);
    return new _LumenSDK(client);
  }
  dns() {
    return this.client.dns();
  }
  gateways() {
    return this.client.gateways();
  }
  releases() {
    return this.client.releases();
  }
  tokenomics() {
    return this.client.tokenomics();
  }
  gov() {
    return this.client.gov();
  }
  async getAccountSnapshot(address) {
    const [height, balance, domains] = await Promise.all([
      this.client.getHeight(),
      this.client.getBalance(address),
      this.client.dns().domainsByOwner(address).catch(() => ({ domains: [] }))
    ]);
    return { height, balance, domains };
  }
  async registerDomain(sender, payload) {
    return this.broadcast(sender, [this.client.dns().msgRegister(sender, payload)]);
  }
  async updateDomain(sender, payload) {
    return this.broadcast(sender, [this.client.dns().msgUpdate(sender, payload)]);
  }
  async renewDomain(sender, payload) {
    return this.broadcast(sender, [this.client.dns().msgRenew(sender, payload)]);
  }
  async transferDomain(sender, payload) {
    return this.broadcast(sender, [this.client.dns().msgTransfer(sender, payload)]);
  }
  async bidOnDomain(sender, payload) {
    return this.broadcast(sender, [this.client.dns().msgBid(sender, payload)]);
  }
  async settleDomain(sender, payload) {
    return this.broadcast(sender, [this.client.dns().msgSettle(sender, payload)]);
  }
  async registerGateway(operator, payload) {
    return this.broadcast(operator, [this.client.gateways().msgRegisterGateway(operator, payload)]);
  }
  async updateGateway(operator, payload) {
    return this.broadcast(operator, [this.client.gateways().msgUpdateGateway(operator, payload)]);
  }
  async createContract(clientAddr, payload) {
    return this.broadcast(clientAddr, [this.client.gateways().msgCreateContract(clientAddr, payload)]);
  }
  async claimGatewayPayment(operator, contractId) {
    return this.broadcast(operator, [this.client.gateways().msgClaimPayment(operator, contractId)]);
  }
  async cancelContract(clientAddr, contractId) {
    return this.broadcast(clientAddr, [this.client.gateways().msgCancelContract(clientAddr, contractId)]);
  }
  async finalizeContract(caller, contractId) {
    return this.broadcast(caller, [this.client.gateways().msgFinalizeContract(caller, contractId)]);
  }
  async publishRelease(creator, payload) {
    return this.broadcast(creator, [this.client.releases().msgPublishRelease(creator, payload)]);
  }
  async mirrorRelease(creator, payload) {
    return this.broadcast(creator, [this.client.releases().msgMirrorRelease(creator, payload)]);
  }
  async yankRelease(creator, id) {
    return this.broadcast(creator, [this.client.releases().msgYankRelease(creator, id)]);
  }
  async validateRelease(authority, id) {
    return this.broadcast(authority, [this.client.releases().msgValidateRelease(authority, id)]);
  }
  async rejectRelease(authority, id) {
    return this.broadcast(authority, [this.client.releases().msgRejectRelease(authority, id)]);
  }
  async updateTokenomics(authority, params) {
    return this.broadcast(authority, [this.client.tokenomics().msgUpdateParams(authority, params)]);
  }
  async submitProposal(proposer, payload) {
    return this.broadcast(proposer, [this.client.gov().msgSubmitProposal(proposer, payload)]);
  }
  async depositToProposal(depositor, payload) {
    return this.broadcast(depositor, [this.client.gov().msgDeposit(depositor, payload)]);
  }
  async voteOnProposal(voter, payload) {
    return this.broadcast(voter, [this.client.gov().msgVote(voter, payload)]);
  }
  async voteWeightedOnProposal(voter, payload) {
    return this.broadcast(voter, [this.client.gov().msgVoteWeighted(voter, payload)]);
  }
  async updateSlashingDowntimeParams(authority, payload) {
    return this.broadcast(authority, [
      this.client.tokenomics().msgUpdateSlashingDowntimeParams(
        authority,
        payload.slashFractionDowntime,
        payload.downtimeJailDuration
      )
    ]);
  }
  broadcast(sender, msgs) {
    return this.client.signAndBroadcast(sender, msgs);
  }
};

// src/utils/index.ts
var utils_exports = {};
__export(utils_exports, {
  addressFromMnemonic: () => addressFromMnemonic,
  bankSend: () => bankSend,
  coin: () => coin,
  coins: () => coins,
  createWallet: () => createWallet,
  gas: () => gas_exports,
  getWalletFrom: () => getWalletFrom,
  looksLikeMnemonic: () => looksLikeMnemonic,
  msg: () => msg,
  parseAddressMaybe: () => parseAddressMaybe,
  resolveDomainOrAddress: () => resolveDomainOrAddress,
  splitFqdn: () => splitFqdn,
  walletFromMnemonic: () => walletFromMnemonic
});
var coin = {
  ulmn: (amount) => coin$1(String(amount), "ulmn"),
  toUlmn: (value) => Math.floor(value).toString(),
  fromUlmn: (value) => Number(value)
};
var coins = {
  ulmn: (amount) => coins$1(String(amount), "ulmn")
};
async function walletFromMnemonic(mnemonic, prefix = LUMEN.bech32Prefix) {
  return DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix });
}
function parseAddressMaybe(value, prefix = LUMEN.bech32Prefix) {
  try {
    const decoded = bech32.decode(value);
    return decoded.prefix === prefix ? value : null;
  } catch {
    return null;
  }
}
function looksLikeMnemonic(input) {
  const words = input.trim().split(/\s+/);
  return words.length >= 12 && words.length <= 24;
}
async function addressFromMnemonic(mnemonic) {
  const signer = await walletFromMnemonic(mnemonic);
  const [account] = await signer.getAccounts();
  return account.address;
}
async function getWalletFrom(input) {
  const addr = parseAddressMaybe(input);
  if (addr) return addr;
  if (looksLikeMnemonic(input)) return addressFromMnemonic(input);
  throw new Error("Input is neither a Lumen bech32 address nor a mnemonic");
}
async function createWallet(strength = 256) {
  const mnemonic = generateMnemonic(strength);
  const signer = await walletFromMnemonic(mnemonic);
  const [account] = await signer.getAccounts();
  return { mnemonic, address: account.address, signer };
}

// src/utils/domain.ts
async function resolveDomainOrAddress(input, client) {
  if (input.includes(".")) return input;
  const addr = parseAddressMaybe(input);
  if (!addr) return null;
  try {
    const payload = await client.dns().domainsByOwner(addr);
    const first = payload?.domains?.[0];
    if (typeof first === "string") return first;
    if (first?.name && first?.ext) return `${first.name}.${first.ext}`;
  } catch {
  }
  return null;
}
function splitFqdn(value) {
  const trimmed = value.trim();
  const match = trimmed.match(/^([^\.]+)\.([^\.]+)$/);
  if (!match) throw new Error(`Invalid domain: ${value}`);
  return { domain: match[1], ext: match[2] };
}
function bankSend(from, to, amount) {
  return {
    typeUrl: "/cosmos.bank.v1beta1.MsgSend",
    value: MsgSend.fromPartial({
      fromAddress: from,
      toAddress: to,
      amount: amount.map((coin2) => ({ ...coin2 }))
    })
  };
}
var msg = {
  bankSend
};

// src/pqc/index.ts
var pqc_exports = {};
__export(pqc_exports, {
  DEFAULT_SCHEME: () => DEFAULT_SCHEME,
  DILITHIUM3_PRIVATE_KEY_BYTES: () => DILITHIUM3_PRIVATE_KEY_BYTES,
  DILITHIUM3_PUBLIC_KEY_BYTES: () => DILITHIUM3_PUBLIC_KEY_BYTES,
  DILITHIUM3_SIGNATURE_BYTES: () => DILITHIUM3_SIGNATURE_BYTES,
  DUAL_SIGNER_BACKUP_TYPE: () => DUAL_SIGNER_BACKUP_TYPE,
  DUAL_SIGNER_BACKUP_VERSION: () => DUAL_SIGNER_BACKUP_VERSION,
  PQC_PREFIX: () => PQC_PREFIX,
  PQC_TYPE_URL: () => PQC_TYPE_URL,
  PqcKeyStore: () => PqcKeyStore,
  computePowDigest: () => computePowDigest,
  computePowNonce: () => computePowNonce,
  computeSignBytes: () => computeSignBytes,
  createKeyPair: () => createKeyPair,
  defaultHomeDir: () => defaultHomeDir,
  exportDualSigner: () => exportDualSigner,
  importDualSigner: () => importDualSigner,
  leadingZeroBits: () => leadingZeroBits,
  sanitizeBodyBytes: () => sanitizeBodyBytes,
  signDilithium: () => sign,
  withPqcExtension: () => withPqcExtension
});
init_keystore();
function computePowDigest(pubKey, nonce) {
  const payload = new Uint8Array(pubKey.length + nonce.length);
  payload.set(pubKey, 0);
  payload.set(nonce, pubKey.length);
  return sha256(payload);
}
function leadingZeroBits(digest) {
  let total = 0;
  for (const byte of digest) {
    if (byte === 0) {
      total += 8;
      continue;
    }
    for (let bit = 7; bit >= 0; bit--) {
      if ((byte >> bit & 1) === 0) {
        total += 1;
      } else {
        return total;
      }
    }
    return total;
  }
  return total;
}
function computePowNonce(pubKey, bits, options = {}) {
  if (bits <= 0) return new Uint8Array([0]);
  const nonceLength = options.nonceLength ?? 8;
  const nonce = new Uint8Array(nonceLength);
  const maxIterations = BigInt(options.maxIterations ?? Number.MAX_SAFE_INTEGER);
  for (let attempts = 0n; attempts < maxIterations; attempts++) {
    if (options.signal?.aborted) {
      throw new Error("pow cancelled");
    }
    writeCounterBigEndian(nonce, attempts);
    const digest = computePowDigest(pubKey, nonce);
    if (leadingZeroBits(digest) >= bits) {
      return nonce.slice();
    }
  }
  throw new Error(`failed to find pow nonce after ${maxIterations} attempts (difficulty=${bits})`);
}
function writeCounterBigEndian(buf, counter) {
  let value = counter;
  for (let i = buf.length - 1; i >= 0; i--) {
    buf[i] = Number(value & 0xffn);
    value >>= 8n;
  }
}

// src/pqc/index.ts
init_constants();

// src/pqc/backup.ts
init_constants();
init_keystore();
var DUAL_SIGNER_BACKUP_TYPE = "lumen/dual-signer";
var DUAL_SIGNER_BACKUP_VERSION = 1;
function exportDualSigner(params) {
  const mnemonic = params.mnemonic?.trim();
  if (!mnemonic) throw new Error("mnemonic is required to export dual signer data");
  const pqcKey = params.pqcKey;
  if (!pqcKey) throw new Error("pqcKey is required to export dual signer data");
  assertKeyShape(pqcKey);
  return {
    type: DUAL_SIGNER_BACKUP_TYPE,
    version: DUAL_SIGNER_BACKUP_VERSION,
    mnemonic,
    bech32Prefix: params.bech32Prefix,
    address: params.address,
    pqc: {
      name: pqcKey.name,
      scheme: pqcKey.scheme,
      publicKey: toBase64(pqcKey.publicKey),
      privateKey: toBase64(pqcKey.privateKey),
      createdAt: pqcKey.createdAt.toISOString()
    }
  };
}
async function importDualSigner(bundle, options = {}) {
  const parsed = normalizeBundle(bundle);
  const keyStore = options.keyStore ?? await PqcKeyStore.open(options.homeDir);
  const keyName = options.keyName ?? parsed.pqc.name;
  if (!options.overwrite && keyStore.getKey(keyName)) {
    throw new Error(`PQC key "${keyName}" already exists. Pass overwrite: true to replace it.`);
  }
  const record = {
    name: keyName,
    scheme: parsed.pqc.scheme || DEFAULT_SCHEME,
    publicKey: fromBase64(parsed.pqc.publicKey),
    privateKey: fromBase64(parsed.pqc.privateKey),
    createdAt: parsed.pqc.createdAt ? new Date(parsed.pqc.createdAt) : /* @__PURE__ */ new Date()
  };
  assertKeyShape(record);
  await keyStore.saveKey(record);
  const saved = keyStore.getKey(keyName);
  if (!saved) throw new Error(`Failed to persist PQC key "${keyName}"`);
  const linkTarget = resolveLinkAddress(parsed, options.linkAddress);
  if (linkTarget) {
    await keyStore.linkAddress(linkTarget, keyName);
  }
  return {
    mnemonic: parsed.mnemonic,
    key: saved,
    keyStore,
    linkedAddress: linkTarget
  };
}
function normalizeBundle(input) {
  const parsed = typeof input === "string" ? JSON.parse(input) : input;
  if (!parsed || typeof parsed !== "object") throw new Error("dual signer backup is invalid");
  if (parsed.type !== DUAL_SIGNER_BACKUP_TYPE) throw new Error(`unexpected backup type: ${parsed.type}`);
  if (parsed.version !== DUAL_SIGNER_BACKUP_VERSION) {
    throw new Error(`unsupported backup version: ${parsed.version}`);
  }
  if (!parsed.mnemonic?.trim()) throw new Error("backup is missing mnemonic");
  if (!parsed.pqc?.publicKey || !parsed.pqc?.privateKey) throw new Error("backup is missing PQC key material");
  return {
    ...parsed,
    mnemonic: parsed.mnemonic.trim()
  };
}
function resolveLinkAddress(parsed, linkOption) {
  if (linkOption === false) return void 0;
  if (typeof linkOption === "string" && linkOption.length > 0) return linkOption;
  return parsed.address;
}
function assertKeyShape(key) {
  const scheme = key.scheme?.toLowerCase() || DEFAULT_SCHEME;
  if (scheme === DEFAULT_SCHEME) {
    if (key.publicKey.length !== DILITHIUM3_PUBLIC_KEY_BYTES) {
      throw new Error(`Dilithium3 public key must be ${DILITHIUM3_PUBLIC_KEY_BYTES} bytes`);
    }
    if (key.privateKey.length !== DILITHIUM3_PRIVATE_KEY_BYTES) {
      throw new Error(`Dilithium3 private key must be ${DILITHIUM3_PRIVATE_KEY_BYTES} bytes`);
    }
  }
}

export { LUMEN, LumenClient, LumenSDK, LumenSigningClient, createRegistry, modules_exports as modules, pqc_exports as pqc, utils_exports as utils };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map