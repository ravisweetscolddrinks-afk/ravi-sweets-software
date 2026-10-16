import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const base64Data = formData.get("base64") as string | null;
    const customFileName = formData.get("fileName") as string | null;
    const folder = (formData.get("folder") as string | null) || "/products";

    if (!file && !base64Data) {
      return NextResponse.json({ error: "No file or base64 data provided" }, { status: 400 });
    }

    const privateKey =
      process.env.IMAGEKIT_PRIVATE_KEY ||
      process.env.VITE_IMAGEKIT_PRIVATE_KEY ||
      "private_J3GwH4xbQz8ZEnUvPAdmZUtYZ90=";

    let base64File = "";
    let finalFileName = customFileName || `upload-${Date.now()}.jpg`;

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      base64File = buffer.toString("base64");
      if (!customFileName) {
        finalFileName = file.name || `upload-${Date.now()}.jpg`;
      }
    } else if (base64Data) {
      // Strip base64 prefix if provided (e.g. data:image/png;base64,...)
      base64File = base64Data.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "");
      if (!customFileName) {
        finalFileName = `qr-${Date.now()}.png`;
      }
    }

    const imageKitFormData = new FormData();
    imageKitFormData.append("file", base64File);
    imageKitFormData.append("fileName", finalFileName);
    imageKitFormData.append("folder", folder);

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
