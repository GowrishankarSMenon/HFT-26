import fs from 'fs';
import path from 'path';

export async function POST(req) {
  try {
    const { data } = await req.json();

    if (!Array.isArray(data) || data.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No data received' }),
        { status: 400 }
      );
    }

    const filePath = path.join(
      process.cwd(),
      'cleaning',
      'kerala_ev_adoption_data.csv'
    );

    const headers =
      'latitude,longitude,ev_adoption_likelihood_score,density_per_km2,population,per_capita_income\n';

    // ✅ Create file with header once
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, headers);
    }

    // ✅ Append rows (ALWAYS 6 VALUES)
    const csvRows = data
      .map(row =>
        [
          row.latitude,
          row.longitude,
          row.ev_adoption_likelihood_score,
          row.density_per_km2,
          row.population,
          row.per_capita_income
        ].join(',')
      )
      .join('\n');

    fs.appendFileSync(filePath, csvRows + '\n');

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200 }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: 'Server error' }),
      { status: 500 }
    );
  }
}
