import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import type { PostgrestError } from '@supabase/supabase-js';

export function useSupabaseQuery<T>(
    tableName: string,
    options: {
        select?: string;
        order?: { column: string; ascending?: boolean };
        limit?: number;
        eq?: [string, any];
    } = {}
) {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<PostgrestError | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase.from(tableName).select(options.select || '*');

            if (options.eq) {
                query = query.eq(options.eq[0], options.eq[1]);
            }

            if (options.order) {
                query = query.order(options.order.column, { ascending: options.order.ascending ?? false });
            }

            if (options.limit) {
                query = query.limit(options.limit);
            }

            const { data: result, error: queryError } = await query;

            if (queryError) throw queryError;
            setData(result as T[]);
        } catch (err: any) {
            setError(err);
            console.error(`Error fetching ${tableName}:`, err);
        } finally {
            setLoading(false);
        }
    }, [tableName, JSON.stringify(options)]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, loading, error, refetch: fetchData };
}

export function useSupabaseMutation(tableName: string) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<PostgrestError | null>(null);

    const insert = async (values: any) => {
        setLoading(true);
        const { data, error } = await supabase.from(tableName).insert(values).select();
        setLoading(false);
        if (error) setError(error);
        return { data, error };
    };

    const update = async (id: string, values: any) => {
        setLoading(true);
        const { data, error } = await supabase.from(tableName).update(values).eq('id', id).select();
        setLoading(false);
        if (error) setError(error);
        return { data, error };
    };

    const remove = async (id: string) => {
        setLoading(true);
        const { error } = await supabase.from(tableName).delete().eq('id', id);
        setLoading(false);
        if (error) setError(error);
        return { error };
    };

    return { insert, update, remove, loading, error };
}
