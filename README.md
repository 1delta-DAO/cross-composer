# Moonbeamer

## Solidity test

The solidity test does not work, because the anvil fork cannot use the precompiles

## Ts Script

Set `.env` file according to the `.env.example` file
Execute with

```bash
pnpm i && pnpm start
```

## Env vars

### `MOONBEAM_RPC_URL`

Moonbeam rpc url (e.g. https://moonbeam.drpc.org)

### `PRIVATE_KEY`

Private key of the permit signer (tx signer)

### `SENDER_PRIVATE_KEY`

Private key of the sender (relay)

### `TEST_ADDR1`

Receives 0.1 xcUSDT (if tx goes through)

### `TEST_ADDR2`

Gets 0.1 xcUSDT allowance
