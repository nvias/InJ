// Photo verification — mock implementation.
// Připraveno pro pozdější napojení na Claude Vision / OpenAI Vision API:
// stačí nahradit tělo funkce `verifyPhoto` reálným voláním a zachovat tvar
// vrácené struktury VerifyResult.

export interface VerifyResult {
  verified: boolean;
  feedback: string;
  checks?: Record<string, boolean>;
}

export interface VerifyOptions {
  prompt?: string;
  checks?: string[];
}

export async function verifyPhoto(
  _imageUrl: string,
  _opts: VerifyOptions = {}
): Promise<VerifyResult> {
  const delay = 2000 + Math.floor(Math.random() * 1000);
  await new Promise((resolve) => setTimeout(resolve, delay));

  return {
    verified: true,
    feedback: "Strom vypadá skvěle!",
    checks: {
      kořeny: true,
      kmen: true,
      koruna: true,
      formulace: true,
    },
  };
}
