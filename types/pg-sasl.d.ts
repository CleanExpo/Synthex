declare module 'pg/lib/crypto/sasl' {
  const sasl: {
    finalizeSession: (
      session: { message: string; serverSignature: string },
      serverData: string
    ) => void;
  };

  export default sasl;
}
