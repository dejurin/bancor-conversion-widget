import { writable } from "svelte/store";
import { bufferToHex, utf8ToHex } from "web3x-es/utils";
import safeFetch from "../utils/safeFetch";
import Contract from "../utils/Contract";
import { addresses } from "../env";

const contractRegistry = writable(undefined);
const bancorNetwork = writable(undefined);
const bntToken = writable(undefined);
const bntConverterRegistry = writable(undefined);
const nonStandardTokenRegistry = writable(undefined);
const tokens = writable(new Map());

const getTokenImg = async symbol => {
  return safeFetch(`https://api.bancor.network/0.1/currencies/${symbol}`).then(
    res => {
      if (!res || !res.data) return;

      const imgFile = res.data.primaryCommunityImageName || "";
      const [name, ext] = imgFile.split(".");

      return `https://storage.googleapis.com/bancor-prod-file-store/images/communities/cache/${name}_200w.${ext}`;
    }
  );
};

const getTokenData = async (eth, address) => {
  const token = await Contract(eth, "ERC20Token", address);

  const [name, symbol] = await Promise.all([
    token.methods.name().call(),
    token.methods.symbol().call()
  ]);

  const img = await getTokenImg(symbol);

  return {
    address,
    name,
    symbol,
    img
  };
};

const init = async eth => {
  const _contractRegistry = await Contract(
    eth,
    "ContractRegistry",
    addresses["7000"].ContractRegistry
  );
  contractRegistry.update(() => _contractRegistry);

  const [
    BancorNetworkAddr,
    BNTTokenAddr,
    BNTConverterAddr,
    NonStandardTokenRegistryAddr
  ] = await Promise.all([
    _contractRegistry.methods
      .addressOf(utf8ToHex("BancorNetwork"))
      .call()
      .then(res => bufferToHex(res.buffer)),
    _contractRegistry.methods
      .addressOf(utf8ToHex("BNTToken"))
      .call()
      .then(res => bufferToHex(res.buffer)),
    _contractRegistry.methods
      .addressOf(utf8ToHex("BNTConverter"))
      .call()
      .then(res => bufferToHex(res.buffer)),
    _contractRegistry.methods
      .addressOf(utf8ToHex("NonStandardTokenRegistry"))
      .call()
      .then(res => bufferToHex(res.buffer))
  ]);

  const _bancorNetwork = await Contract(
    eth,
    "BancorNetwork",
    BancorNetworkAddr
  );
  bancorNetwork.update(() => _bancorNetwork);

  const _bntToken = await Contract(eth, "SmartToken", BNTTokenAddr);
  bntToken.update(() => _bntToken);

  const _bntConverterRegistry = await Contract(
    eth,
    "BancorConverter",
    BNTConverterAddr
  );
  bntConverterRegistry.update(() => _bntConverterRegistry);

  const _nonStandardTokenRegistry = await Contract(
    eth,
    "NonStandardTokenRegistry",
    NonStandardTokenRegistryAddr
  );
  nonStandardTokenRegistry.update(() => _nonStandardTokenRegistry);

  // add bnt
  const bntTokenData = await getTokenData(eth, _bntToken.address);
  tokens.update(v => {
    v.set(_bntToken.address, bntTokenData);

    return v;
  });

  // add bnt connectors
  const connectorCount = await _bntConverterRegistry.methods
    .connectorTokenCount()
    .call();

  let i = Number(connectorCount);
  while (--i >= 0) {
    const address = await _bntConverterRegistry.methods
      .connectorTokens(i)
      .call()
      .then(res => bufferToHex(res.buffer));

    const data = await getTokenData(eth, address);

    tokens.update(v => {
      v.set(address, data);

      return v;
    });
  }
};

export {
  contractRegistry,
  bancorNetwork,
  bntToken,
  bntConverterRegistry,
  nonStandardTokenRegistry,
  tokens,
  init
};
