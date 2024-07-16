# Avocado-SDK

## Overview

What does avocado do

- video / audio calls
- remote desktop control
- remote file transfer

How does it work

1. [*prepare*] `Agent` checks if the minimum requirement is met. If then,
2. [*setup*] `Agent` registers to local `Server`.
3. [*dial*] `Server` receives connection requests from `Client`, check the `Client` authority and performs negotiation between `Client` and `Agent`.
4. [*connect*]`Client` establish a PeerConnection to the `Agent`.
5. [*transmit*] Any data and ops are transmitted through the PeerConnection.

See [Documentation](/docs/README.md) for further information

## Structure
