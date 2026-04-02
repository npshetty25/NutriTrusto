import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const upc = searchParams.get("upc");
    
    if (!upc) {
      return NextResponse.json({ error: "No UPC provided" }, { status: 400 });
    }

    const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${upc}`);
    
    if (!res.ok) {
      return NextResponse.json({ error: "API limit or error" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
    
  } catch (error: any) {
    console.error("UPC Lookup Error:", error);
    return NextResponse.json({ error: "Failed to fetch from UPC registry" }, { status: 500 });
  }
}
