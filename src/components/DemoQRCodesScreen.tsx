import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Coffee, BookOpen, ShoppingBag, QrCode, CheckCircle2, ArrowRight } from "lucide-react";

interface DemoQRCodesScreenProps {
  onNavigate: (page: string, scannedData?: string) => void;
}

export const demoMerchants = [
  {
    merchantId: "CANT001",
    merchantName: "Canteen",
    paymentAmount: 40,
    category: "Food",
    description: "Canteen Snacks & Tea",
    icon: Coffee,
    color: "amber"
  },
  {
    merchantId: "LIB001",
    merchantName: "Library",
    paymentAmount: 20,
    category: "Books",
    description: "Library Late Fee & Printing",
    icon: BookOpen,
    color: "blue"
  },
  {
    merchantId: "STAT001",
    merchantName: "Stationery",
    paymentAmount: 60,
    category: "Books",
    description: "Stationery Notebooks & Pens",
    icon: ShoppingBag,
    color: "purple"
  }
];

export default function DemoQRCodesScreen({ onNavigate }: DemoQRCodesScreenProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleTestScan = (merchant: typeof demoMerchants[0]) => {
    const qrPayload = JSON.stringify({
      merchantId: merchant.merchantId,
      merchantName: merchant.merchantName,
      paymentAmount: merchant.paymentAmount,
      category: merchant.category,
      description: merchant.description
    });
    
    // Copy payload to clipboard if needed
    navigator.clipboard?.writeText?.(qrPayload);
    setCopiedId(merchant.merchantId);
    
    // Navigate to QR payment screen with pre-scanned data
    setTimeout(() => {
      onNavigate("qr-payment", qrPayload);
    }, 400);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate("dashboard")}
            className="p-2 hover:bg-slate-100 rounded-xl transition"
          >
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Demo Merchant QR Codes</h2>
            <p className="text-xs text-slate-500 font-medium">Scan these valid QR codes using your device camera or tap to test scan</p>
          </div>
        </div>

        <button
          onClick={() => onNavigate("qr-payment")}
          className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2"
        >
          <QrCode className="h-4 w-4" /> Open Camera Scanner
        </button>
      </div>

      {/* Grid of Demo Merchants */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {demoMerchants.map((merchant) => {
          const Icon = merchant.icon;
          const qrData = JSON.stringify({
            merchantId: merchant.merchantId,
            merchantName: merchant.merchantName,
            paymentAmount: merchant.paymentAmount
          });

          return (
            <div
              key={merchant.merchantId}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 text-center space-y-4 hover:shadow-md transition relative flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Header tag */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                      <Icon className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-base font-black text-slate-900">{merchant.merchantName}</h3>
                      <span className="text-[10px] text-slate-400 font-mono font-bold block">{merchant.merchantId}</span>
                    </div>
                  </div>
                  <span className="text-lg font-black text-blue-900">₹{merchant.paymentAmount}</span>
                </div>

                {/* Valid SVG QR Code */}
                <div className="p-4 bg-white border-2 border-slate-100 rounded-2xl inline-block shadow-2xs my-2">
                  <QRCodeSVG
                    value={qrData}
                    size={160}
                    level="H"
                    includeMargin={true}
                    fgColor="#0f172a"
                  />
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs text-slate-600 font-medium">
                  {merchant.description}
                </div>
              </div>

              {/* Instant Test Trigger */}
              <button
                onClick={() => handleTestScan(merchant)}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 group mt-2"
              >
                {copiedId === merchant.merchantId ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Loaded into Scanner!
                  </>
                ) : (
                  <>
                    <span>Test Scan ₹{merchant.paymentAmount}</span>
                    <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition" />
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Instruction Card */}
      <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-5 text-xs text-blue-900 flex items-start gap-3">
        <QrCode className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold block text-sm">How to test QR Scanning:</span>
          <p className="text-blue-800 leading-relaxed">
            • <strong>Device Camera:</strong> Open the QR Payment scanner page and point your camera at any of the 3 QR codes above.
          </p>
          <p className="text-blue-800 leading-relaxed">
            • <strong>Instant Scan Button:</strong> Click the "Test Scan" button under any merchant card to simulate scanning the QR code immediately.
          </p>
        </div>
      </div>
    </div>
  );
}
