import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const privateKey =
      process.env.IMAGEKIT_PRIVATE_KEY ||
      process.env.VITE_IMAGEKIT_PRIVATE_KEY ||
      "private_J3GwH4xbQz8ZEnUvPAdmZUtYZ90=";

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64File = buffer.toString("base64");

    const imageKitFormData = new FormData();
    imageKitFormData.append("file", base64File);
    imageKitFormData.append("fileName", file.name || `product-${Date.now()}.jpg`);
    imageKitFormData.append("folder", "/products");

    const authHeader = "Basic " + Buffer.from(privateKey + ":").toString("base64");

    const response = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
      method: "POST",
      headers: {
        Authorization: authHeader,
      },
      body: imageKitFormData,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("ImageKit upload error:", data);
      return NextResponse.json(
        { error: data.message || "Failed to upload image to ImageKit" },
        { status: response.status }
      );
    }

    return NextResponse.json({
      url: data.url,
      thumbnailUrl: data.thumbnailUrl || data.url,
      fileId: data.fileId,
      name: data.name,
    });
  } catch (error: any) {
    console.error("Upload API route error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
