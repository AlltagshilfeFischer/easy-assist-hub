import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';

function useVpRenewalKunden() {
  const currentYearStart = `${new Date().getFullYear()}-01-01`;

  return useQuery({
    queryKey: ['vp-renewal-kunden', currentYearStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kunden')
        .select('id, vorname, nachname, kunden_nummer, verhinderungspflege_genehmigt_am')
        .eq('aktiv', true)
        .eq('verhinderungspflege_aktiv', true)
        .or(`verhinderungspflege_genehmigt_am.is.null,verhinderungspflege_genehmigt_am.lt.${currentYearStart}`);

      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function VpRenewalAlert() {
  const { isGeschaeftsfuehrer, isGlobalAdmin } = useUserRole();
  const navigate = useNavigate();
  const { data: kunden = [], isLoading } = useVpRenewalKunden();

  if (!isGeschaeftsfuehrer && !isGlobalAdmin) return null;
  if (isLoading || kunden.length === 0) return null;

  return (
    <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="text-amber-800 dark:text-amber-300 font-semibold">
        Verhinderungspflege neu beantragen ({kunden.length} {kunden.length === 1 ? 'Kunde' : 'Kunden'})
      </AlertTitle>
      <AlertDescription className="mt-2">
        <p className="text-amber-700 dark:text-amber-400 text-sm mb-3">
          Für folgende Kunden ist die Verhinderungspflege aktiv, aber noch nicht für {new Date().getFullYear()} genehmigt:
        </p>
        <div className="flex flex-wrap gap-2">
          {kunden.map((k) => (
            <button
              key={k.id}
              onClick={() => navigate(`/dashboard/master-data?kunde=${k.id}&tab=abrechnung`)}
              className="flex items-center gap-1.5 text-xs bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 px-2.5 py-1 rounded-full transition-colors border border-amber-200 dark:border-amber-700"
            >
              <span>{k.vorname} {k.nachname}</span>
              {k.kunden_nummer && (
                <Badge variant="outline" className="text-xs h-4 border-amber-300 dark:border-amber-600 px-1">
                  #{k.kunden_nummer}
                </Badge>
              )}
              <ExternalLink className="h-3 w-3 opacity-60" />
            </button>
          ))}
        </div>
      </AlertDescription>
    </Alert>
  );
}
