import fs from 'fs';
import path from 'path';

export async function POST(req) {
  try {
    const { userId, rows } = await req.json();

    if (!userId || !Array.isArray(rows) || rows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid payload' }),
        { status: 400 }
      );
    }

    // 🔥 UPDATED PATH (inside /cleaning/userparames)
    const dir = path.join(
      process.cwd(),
      'cleaning',
      'userparames'
    );

    const filePath = path.join(dir, `${userId}.csv`);

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const header = 'latitude,longitude,parameter,weight,proportionality,cost\n';

    // Create file with header once
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, header);
    }

    // Append rows
    const csvRows = rows
      .map(r => {
        const weight = Number(r.weight);
        const prop = Number(r.proportionality);
        const cost = weight * prop;

        return [
          r.latitude,
          r.longitude,
          r.parameter,
          weight,
          prop,
          cost
        ].join(',');
      })
      .join('\n');

    fs.appendFileSync(filePath, csvRows + '\n');

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200 }
    );
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ error: 'Server error' }),
      { status: 500 }
    );
  }
}
