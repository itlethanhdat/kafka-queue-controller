"use client";

import { useEffect } from "react";
import { initCrypto } from "@/lib/crypto";

/** Invisibly initialises the AES key on first client render. */
export default function CryptoInit() {
  useEffect(() => {
    initCrypto().catch(console.error);
  }, []);
  return null;
}
