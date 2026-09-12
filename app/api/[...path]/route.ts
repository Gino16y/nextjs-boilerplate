import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  const parts = path || [];
  let apiUrl = "";

  if (parts[0] === "friends" && parts[1]) {
    apiUrl = `https://friends.roblox.com/v1/users/${parts[1]}/friends/count`;
  } else if (parts[0] === "followers" && parts[1]) {
    apiUrl = `https://friends.roblox.com/v1/users/${parts[1]}/followers/count`;
  } else if (parts[0] === "followings" && parts[1]) {
    apiUrl = `https://friends.roblox.com/v1/users/${parts[1]}/followings/count`;
  } else if (parts[0] === "wearing" && parts[1]) {
    apiUrl = `https://avatar.roblox.com/v1/users/${parts[1]}/currently-wearing`;
  } else if (parts[0] === "item" && parts[1]) {
    // handled separately below (POST request, not a simple GET passthrough)
    apiUrl = "ITEM_DETAILS";
  } else if (parts[0]) {
    apiUrl = `https://users.roblox.com/v1/users/${parts[0]}`;
  } else {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    if (apiUrl === "ITEM_DETAILS") {
      const assetId = Number(parts[1]);
      const detailsRes = await fetch(
        "https://catalog.roblox.com/v1/catalog/items/details",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0",
          },
          body: JSON.stringify({
            items: [{ itemType: "Asset", id: assetId }],
          }),
        }
      );
      const detailsData = await detailsRes.json();
      const item = detailsData?.data?.[0];

      if (!item) {
        return NextResponse.json({ error: "NotFound" }, { status: 404, headers });
      }

      return NextResponse.json(
        {
          Name: item.name,
          PriceRobux: item.price ?? null,
          Creator: item.creatorName || "Unknown",
          IsForSale: !!item.price || item.isForSale === true,
        },
        { headers }
      );
    }

    const response = await fetch(apiUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
      },
    });
    const data = await response.json();

    if (parts[0] === "wearing" && parts[1]) {
      const assetIds: number[] = data.assetIds || [];

      if (assetIds.length === 0) {
        return NextResponse.json({ assets: [] }, { headers });
      }

      const idsParam = assetIds.join(",");
      const thumbUrl = `https://thumbnails.roblox.com/v1/assets?assetIds=${idsParam}&size=150x150&format=Png&isCircular=false`;

      const thumbRes = await fetch(thumbUrl, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0",
        },
      });
      const thumbData = await thumbRes.json();

      const thumbMap: Record<number, string> = {};
      (thumbData.data || []).forEach((item: { targetId: number; imageUrl: string }) => {
        thumbMap[item.targetId] = item.imageUrl;
      });

      const assets = assetIds.map((id) => ({
        id,
        Image: thumbMap[id] || null,
      }));

      return NextResponse.json({ assets }, { headers });
    }

    return NextResponse.json(data, { headers });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
