import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || "");

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Call the local Python OCR server
    const pythonFormData = new FormData();
    pythonFormData.append('file', file);

    try {
      const response = await fetch('http://localhost:5000/process', {
        method: 'POST',
        body: pythonFormData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Python server error');
      }

      const result = await response.json();
      return NextResponse.json({ data: result.data });

    } catch (connError) {
      console.error("Connection to Python server failed:", connError);
      return NextResponse.json({ 
        error: "Python OCR server is not running. Please start it on port 5000.",
        help: "Run: python ocr_backend/app.py"
      }, { status: 503 });
    }

  } catch (error: any) {
    console.error("OCR Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
