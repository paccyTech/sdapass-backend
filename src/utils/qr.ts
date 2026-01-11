import QRCode from "qrcode";

export const generateQrPayload = async (token: string): Promise<string> => {
  return QRCode.toDataURL(JSON.stringify({ token }));
};
