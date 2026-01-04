import { NextResponse } from 'next/server';
import { districtData } from '@/utils/districtData';

export async function POST(request) {
    try {
        const { district } = await request.json();

        const data = districtData[district];

        if (!data) {
            return NextResponse.json({ error: 'District not found' }, { status: 404 });
        }

        return NextResponse.json({ data });
    } catch (error) {
        console.error('Error fetching district stats:', error);
        return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }
}