import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  // Verify authentication
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const imageFile = formData.get("image") as File | null;

  if (!imageFile) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }

  // Validate MIME type
  const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
  if (!allowedMimes.includes(imageFile.type)) {
    return NextResponse.json(
      { error: `Unsupported image type: ${imageFile.type}. Allowed: JPEG, PNG, WebP, HEIC/HEIF` },
      { status: 400 }
    );
  }

  // Validate file size (max 5MB)
  const MAX_SIZE = 5 * 1024 * 1024;
  if (imageFile.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "Image too large. Maximum size is 5MB." },
      { status: 400 }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  if (!apiKey) {
    return NextResponse.json(
      { error: "Gemini API key not configured" },
      { status: 500 }
    );
  }

  try {
    const bytes = await imageFile.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mimeType = imageFile.type || "image/jpeg";

    const prompt = `この採点済みテスト用紙の画像を解析してください。用紙全体が写っている前提です。部分的な撮影の場合は confidence を低めにしてください。

【プリントのレイアウト情報】
■ 英語: A4縦レイアウト
  - ヘッダーは上部に横書きで、左から順に:
    1. 科目名「英語」
    2. 教材名（「英文法１」「英文法 入門」「英熟語」「英単語」など）
    3. 「/」区切りの後に単元名
    4. 得点○/○
    5. ステップ○/○
  - 例1: 「英語　英文法１ / 【I】主語と動詞,品詞　得点28/31　ステップ1/2」
  - 例2: 「英語　英文法　入門 / 【I】文のきまり①　得点15/20　ステップ1/2」
  - ※「英文法」の後にスペースを挟んで「入門」が続く場合 → content_group_name は「英文法 入門」
  - ※「英文法」の後に数字（１、1など）が続く場合 → content_group_name は「英文法」
  - ※ヘッダーの「英文法」と「入門」の間にスペースがあっても1つの教材名「英文法 入門」として扱う

■ 数学: A4縦レイアウト
  - ヘッダーは上部に横書きで、左から順に:
    1. 科目名「数学」
    2. 教材名（「数学１年」「1年のまとめ」「数学２年」「2年のまとめ」など）
    3. 「/」区切りの後に単元名
    4. 得点○/○
    5. ステップ○/○
  - 例: 「数学　数学１年 / 正負の数の加法①(整数)　得点15/20　ステップ1/2」
  - 「数学１年」→ content_group_name は「1年[共通版]」
  - 「1年のまとめ」→ content_group_name は「1年のまとめ」
  - 「数学２年」→ content_group_name は「2年[共通版]」
  - 「2年のまとめ」→ content_group_name は「2年のまとめ」

■ 国語（漢字）: A4横レイアウト
  - ヘッダーは左側に縦書きで: 単元名、得点○/○、ステップ○/○

【重要な区別ルール - 英語教材】
- 「英文法」+数字（「英文法１」「英文法1」）→ content_group_name:「英文法」
- 「英文法」+スペース+「入門」（「英文法　入門」「英文法 入門」）→ content_group_name:「英文法 入門」
- ※「入門」という文字が含まれるかどうかが最も重要な判定基準

【重要な区別ルール - 数学教材】
- 「数学１年」「数学1年」→ content_group_name:「1年[共通版]」
- 「1年のまとめ」→ content_group_name:「1年のまとめ」
- 「数学２年」「数学2年」→ content_group_name:「2年[共通版]」
- 「2年のまとめ」→ content_group_name:「2年のまとめ」
- ※「まとめ」が含まれるかどうかが最も重要な判定基準

【読み取り対象】
1. subject_name: 科目名（「英語」「数学」「国語」「理科」「社会」「算数」のいずれか。判別できない場合はnull）
2. content_group_name: 教材名。以下の候補リストから最も一致するものを選んで返すこと（自由記述ではなく候補から選択）:
   英語: 「英文法」「英文法 入門」「英熟語 高校入試重要300」「英単語 高校入試重要600」
   数学: 「1年のまとめ」「2年のまとめ」「1年[共通版]」「2年[共通版]」
   国語: 「東京書籍1年 漢字」「東京書籍2年 漢字」
   ※ヘッダーに「入門」があれば必ず「英文法 入門」を返す。「入門」がなければ「英文法」を返す。
   ※ヘッダーに「まとめ」があれば「○年のまとめ」を返す。なければ「○年[共通版]」を返す。
   判別できない場合はnull。
3. unit_name: 単元名（ヘッダーの「/」の後に記載されている単元名をそのまま転記。判別できない場合はnull）
4. step_type: ステップ種別（以下のいずれか。判別できない場合はnull）
   - 「ラーニング」「Learning」→ "learning"
   - 「ステップ1」「Step1」「S1」→ "step1"
   - 「ステップ2」「Step2」「S2」→ "step2"
5. score: ヘッダーの得点欄の分子（採点された点数。数値。読み取れない場合はnull）
6. max_score: ヘッダーの得点欄の分母（満点。数値。読み取れない場合はnull）
7. confidence: 全体の読み取り信頼度（0.0〜1.0。1.0が最も確信度が高い）

必ず以下のJSON形式のみで回答してください。他のテキストは含めないでください。
{"subject_name": "文字列またはnull", "content_group_name": "文字列またはnull", "unit_name": "文字列またはnull", "step_type": "文字列またはnull", "score": 数値またはnull, "max_score": 数値またはnull, "confidence": 0.0から1.0}`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType,
                    data: base64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 512,
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error:", errorText);
      return NextResponse.json(
        { error: "AI analysis failed" },
        { status: 502 }
      );
    }

    const geminiData = await geminiResponse.json();
    // Gemini 2.5 Pro returns thinking + response in separate parts
    // Extract text from all non-thought parts
    const parts = geminiData.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .filter((p: { thought?: boolean; text?: string }) => !p.thought && p.text)
      .map((p: { text: string }) => p.text)
      .join("");

    // Extract JSON from response (handle ```json ... ``` wrapping)
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "");
    const jsonMatch = cleaned.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Could not parse AI response" },
        { status: 502 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Normalize step_type (handle fullwidth, hyphens, spaces, etc.)
    let stepType: string | null = parsed.step_type;
    if (stepType) {
      const normalized = stepType
        .normalize("NFKC") // fullwidth → halfwidth (Ｓ１ → S1, etc.)
        .toLowerCase()
        .replace(/[\s\-_・]+/g, ""); // remove spaces, hyphens, underscores, middot
      if (["learning", "ラーニング"].includes(normalized)) stepType = "learning";
      else if (["step1", "s1", "ステップ1"].includes(normalized)) stepType = "step1";
      else if (["step2", "s2", "ステップ2"].includes(normalized)) stepType = "step2";
      else stepType = null; // unrecognized → null
    }

    // Clamp and validate numeric values
    const scoreVal = parsed.score != null ? Number(parsed.score) : null;
    const maxScoreVal = parsed.max_score != null ? Number(parsed.max_score) : null;
    const confidenceVal = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));

    return NextResponse.json({
      subject_name: parsed.subject_name ?? null,
      content_group_name: parsed.content_group_name ?? null,
      unit_name: parsed.unit_name ?? null,
      step_type: stepType,
      score: scoreVal !== null && !isNaN(scoreVal) ? scoreVal : null,
      max_score: maxScoreVal !== null && !isNaN(maxScoreVal) ? maxScoreVal : null,
      confidence: confidenceVal,
      raw_response: text,
    });
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: "Analysis failed" },
      { status: 500 }
    );
  }
}
