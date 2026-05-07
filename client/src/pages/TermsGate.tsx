import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface Props {
  userId: string;
  onAccepted: () => void;
}

export default function TermsGate({ userId, onAccepted }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop <= el.clientHeight + 40) {
      setScrolled(true);
    }
  };

  const handleAccept = async () => {
    setAccepting(true);
    await supabase
      .from('profiles')
      .update({ terms_accepted_at: new Date().toISOString() })
      .eq('id', userId);
    onAccepted();
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">

        <div className="text-center mb-6">
          <div className="font-mono text-army-gold text-2xl font-bold tracking-[0.3em]">NCO.AI</div>
          <div className="font-mono text-army-tan text-xs tracking-[0.2em] mt-1 uppercase">Acceptable Use Agreement</div>
        </div>

        <div className="border border-border bg-surface">
          {/* Scrollable terms body */}
          <div
            onScroll={handleScroll}
            className="h-96 overflow-y-auto px-8 py-6 space-y-5 text-army-text font-mono text-xs leading-relaxed"
          >
            <div>
              <div className="text-army-gold text-[10px] tracking-widest uppercase mb-2">1. Platform Status</div>
              <p>NCO.AI is a commercial leadership tool developed by AIM Pact Technology. It is <strong>not</strong> an authorized U.S. Army, Department of Defense, or U.S. Government system. It has no Authorization to Operate (ATO) and is not approved for use on government networks, government-issued devices, or NIPR/SIPR.</p>
            </div>

            <div>
              <div className="text-army-gold text-[10px] tracking-widest uppercase mb-2">2. Authorized Use</div>
              <p>This platform is intended for use on personal devices over commercial internet connections only. It may be used to assist with unclassified, non-sensitive unit administration tasks such as counseling documentation, evaluation writing, training planning, and leader development.</p>
            </div>

            <div>
              <div className="text-army-gold text-[10px] tracking-widest uppercase mb-2">3. Prohibited Information</div>
              <p>You <strong>must not</strong> enter any of the following into this platform:</p>
              <ul className="list-disc list-inside mt-2 space-y-1 pl-2 text-army-muted">
                <li>Classified information (any level)</li>
                <li>Social Security Numbers (SSNs)</li>
                <li>Medical or mental health records (HIPAA-protected)</li>
                <li>Law enforcement sensitive information</li>
                <li>Information controlled under ITAR or EAR</li>
                <li>Any information marked CUI//SP-CTI, CUI//SP-LEI, or higher</li>
              </ul>
            </div>

            <div>
              <div className="text-army-gold text-[10px] tracking-widest uppercase mb-2">4. Data Storage &amp; Privacy</div>
              <p>Data you enter — including soldier names, ranks, unit information, and counseling records — is stored on commercial cloud infrastructure operated by Supabase, Inc. and Vercel, Inc. Both are SOC 2 Type II certified. AI queries are processed by Anthropic, PBC via their API. No data is sold to third parties.</p>
              <p className="mt-2">You are responsible for compliance with AR 25-22 (Army Privacy Program) and applicable DoD privacy regulations. Personnel data entered constitutes Personally Identifiable Information (PII) and must be handled accordingly.</p>
            </div>

            <div>
              <div className="text-army-gold text-[10px] tracking-widest uppercase mb-2">5. AI Accuracy</div>
              <p>AI-generated content — including counseling statements, NCOER bullets, award citations, and doctrine responses — may contain errors. Always verify outputs against official Army publications before use. The AI advisor is not a substitute for legal counsel, JAG guidance, or a senior NCO's judgment.</p>
            </div>

            <div>
              <div className="text-army-gold text-[10px] tracking-widest uppercase mb-2">6. Data Retention &amp; Deletion</div>
              <p>Your data is retained for as long as your account is active. You may request deletion of your account and all associated data at any time by contacting support. Data is not retained after account deletion.</p>
            </div>

            <div>
              <div className="text-army-gold text-[10px] tracking-widest uppercase mb-2">7. User Responsibility</div>
              <p>By using this platform you acknowledge that you are solely responsible for ensuring your use complies with applicable Army regulations, unit policies, and federal law. AIM Pact Technology assumes no liability for misuse of the platform or violations of Army policy by users.</p>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-army-muted text-[10px]">Questions or data requests: contact@aimpacttechnology.com</p>
              <p className="text-army-muted text-[10px] mt-1">AIM Pact Technology · Commercial Platform · Not a Government System</p>
            </div>
          </div>

          {/* Accept bar */}
          <div className="border-t border-border px-8 py-4 bg-bg">
            {!scrolled && (
              <div className="font-mono text-[10px] text-army-muted text-center mb-3">
                Scroll to read the full agreement before accepting.
              </div>
            )}
            <button
              onClick={handleAccept}
              disabled={!scrolled || accepting}
              className="w-full bg-army-tan hover:bg-[#9e8562] disabled:opacity-40 disabled:cursor-not-allowed text-army-text font-mono text-sm tracking-widest uppercase py-3 transition-colors"
            >
              {accepting ? 'SAVING...' : 'I UNDERSTAND AND ACCEPT'}
            </button>
            <div className="font-mono text-[9px] text-army-muted text-center mt-2">
              By accepting you confirm you have read this agreement and will use NCO.AI in accordance with its terms.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
