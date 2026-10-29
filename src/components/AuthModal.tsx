import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  X,
  Droplets,
  Mail,
  Lock,
  User,
  Phone,
  Shield,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Home,
  MapPin,
  FileText,
  BadgeAlert,
} from 'lucide-react';
import {
  createConsumerRegistrationRequest,
  getHouseholdByCustomerCode,
} from '../services/dbService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register' | 'admin';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
}) => {
  const { lang, t } = useLanguage();
  const {
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    sendPasswordRecovery,
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'register' | 'admin' | 'forgot'>(initialMode);
  const [registrationType, setRegistrationType] = useState<'EXISTING_LINK' | 'NEW_CONNECTION'>('EXISTING_LINK');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerCode, setCustomerCode] = useState('');
  const [ward, setWard] = useState('1');
  const [tole, setTole] = useState('');
  const [address, setAddress] = useState('');
  const [meterNumber, setMeterNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'forgot') {
        if (!email.trim()) throw new Error('Please enter your registered email address.');
        await sendPasswordRecovery(email.trim());
        setSuccess(
          lang === 'ne'
            ? 'पासवर्ड रिसेट लिङ्क तपाईंको इमेलमा पठाइएको छ। कृपया आफ्नो इनबक्स जाँच गर्नुहोस्।'
            : 'Password reset instructions have been sent to your email.'
        );
        return;
      }

      if (mode === 'login' || mode === 'admin') {
        await signInWithEmail(email.trim(), password);
        onClose();
      } else {
        // Registration mode
        if (!displayName.trim()) {
          throw new Error(lang === 'ne' ? 'कृपया उपभोक्ताको पूरा नाम प्रविष्ट गर्नुहोस्।' : 'Please enter full name.');
        }

        if (registrationType === 'EXISTING_LINK') {
          const codeUpper = customerCode.trim().toUpperCase();
          if (!codeUpper) {
            throw new Error(
              lang === 'ne'
                ? 'कृपया तपाईंको स्थायी ग्राहक कोड (जस्तै HYT-00101) प्रविष्ट गर्नुहोस्।'
                : 'Please enter your permanent Customer ID (e.g. HYT-00101).'
            );
          }

          // Verify household existence and phone matching
          const household = await getHouseholdByCustomerCode(codeUpper);
          if (!household) {
            throw new Error(
              lang === 'ne'
                ? `ग्राहक कोड "${codeUpper}" फेला परेन। कृपया आफ्नो रसिदमा भएको कोड जाँच गर्नुहोस्।`
                : `Customer code "${codeUpper}" not found in committee records.`
            );
          }

          const cleanPhone = phoneNumber.replace(/\D/g, '');
          const cleanHouseholdPhone = (household.phoneNumber || '').replace(/\D/g, '');
          const phoneMatches =
            cleanPhone &&
            cleanHouseholdPhone &&
            (cleanHouseholdPhone.endsWith(cleanPhone.slice(-6)) || cleanPhone.endsWith(cleanHouseholdPhone.slice(-6)));

          if (phoneMatches) {
            // Phone strictly matches: link immediately!
            await registerWithEmail(email.trim(), password, displayName.trim(), codeUpper);
            setSuccess(
              lang === 'ne'
                ? `प्रमाणीकरण सफल! ग्राहक कोड ${codeUpper} तपाईंको खातासँग जोडिएको छ।`
                : `Account verified and linked to Customer Code ${codeUpper}!`
            );
            setTimeout(() => onClose(), 1200);
          } else {
            // Phone does not match or was not recorded: submit safe approval request to prevent hijacking
            await registerWithEmail(email.trim(), password, displayName.trim());
            await createConsumerRegistrationRequest({
              requestType: 'EXISTING_HOUSEHOLD_LINK',
              fullName: displayName.trim(),
              phoneNumber: phoneNumber.trim(),
              email: email.trim(),
              ward: household.ward || '1',
              tole: household.tole || '',
              address: household.address || '',
              existingCustomerCode: codeUpper,
              applicantNotes: `सुरक्षा प्रमाणीकरण: फोन नं मेल नखाएको वा नयाँ नम्बरबाट लिङ्किङ आवेदन (${phoneNumber.trim()})`,
            });

            setSuccess(
              lang === 'ne'
                ? `खाता दर्ता भयो। सुरक्षाका लागि तपाईंको फोन नम्बर कार्यालयको रेकर्डसँग मेल नखाएकाले प्रमाणीकरण आवेदन पठाइएको छ। समितिले स्वीकृत गरेपछि बिलिङ सक्रिय हुनेछ।`
                : `Account created. Verification request submitted for Customer ID ${codeUpper}. Committee admin will review and approve shortly.`
            );
            setTimeout(() => onClose(), 2500);
          }
        } else {
          // Brand New Consumer Application (No Tap / Needs New Tap)
          await registerWithEmail(email.trim(), password, displayName.trim());
          await createConsumerRegistrationRequest({
            requestType: 'NEW_CONNECTION',
            fullName: displayName.trim(),
            phoneNumber: phoneNumber.trim(),
            email: email.trim(),
            ward: ward.trim(),
            tole: tole.trim(),
            address: address.trim(),
            meterNumber: meterNumber.trim(),
            applicantNotes: notes.trim(),
          });

          setSuccess(
            lang === 'ne'
              ? `नयाँ उपभोक्ता आवेदन सफलतापूर्वक दर्ता भयो! समिति प्रशासनले प्रमाणीकरण गरेपछि तपाईंलाई स्थायी ग्राहक कोड (HYT-XXXXX) जारी गरिनेछ।`
              : `New consumer application submitted! Committee admin will review and issue your permanent Customer ID (HYT-XXXXX).`
          );
          setTimeout(() => onClose(), 2500);
        }
      }
    } catch (err: any) {
      console.error(err);
      let msg = err.message || 'Authentication error';
      if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential')) {
        msg = lang === 'ne' ? 'इमेल वा पासवर्ड मिलेन। कृपया पुन: प्रयास गर्नुहोस्।' : 'Invalid email or password.';
      } else if (msg.includes('email-already-in-use')) {
        msg = lang === 'ne' ? 'यो इमेल पहिले नै दर्ता भइसकेको छ। कृपया लगइन गर्नुहोस्।' : 'This email is already registered. Please login.';
      } else if (msg.includes('weak-password')) {
        msg = lang === 'ne' ? 'पासवर्ड कम्तिमा ६ अक्षरको हुनुपर्छ।' : 'Password must be at least 6 characters.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Google Sign-In failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden my-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-800 to-indigo-900 p-5 sm:p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full text-sky-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl bg-sky-500/30 flex items-center justify-center border border-sky-400/30">
              <Droplets className="w-4 h-4 text-sky-200" />
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-200">
              {lang === 'ne' ? 'खानेपानी महसुल तथा उपभोक्ता पोर्टल' : 'Drinking Water Portal'}
            </span>
          </div>

          <h2 className="text-xl font-bold">
            {mode === 'login'
              ? (lang === 'ne' ? 'उपभोक्ता लगइन (Consumer Login)' : 'Consumer Login')
              : mode === 'admin'
              ? (lang === 'ne' ? 'समिति प्रशासन तथा कर्मचारी लगइन' : 'Admin & Staff Portal')
              : mode === 'forgot'
              ? (lang === 'ne' ? 'पासवर्ड रिकभरी' : 'Password Recovery')
              : (lang === 'ne' ? 'नयाँ खाता दर्ता (Create Account)' : 'Create Consumer Account')}
          </h2>
          <p className="text-xs text-sky-200 mt-0.5">
            {mode === 'admin'
              ? (lang === 'ne' ? 'अधिकृत सुपर एडमिन तथा कर्मचारी मात्र' : 'Authorized committee officials only.')
              : (lang === 'ne' ? 'आफ्नो घरधुरीको महसुल, रसिद र भुक्तानी विवरण हेर्न' : 'Access your household bills, payment receipts, and vouchers.')}
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-200 text-xs font-semibold bg-slate-50">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
              setSuccess('');
            }}
            className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer ${
              mode === 'login'
                ? 'border-sky-600 text-sky-700 bg-white font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {lang === 'ne' ? 'लगइन (Sign In)' : 'Sign In'}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError('');
              setSuccess('');
            }}
            className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer ${
              mode === 'register'
                ? 'border-sky-600 text-sky-700 bg-white font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {lang === 'ne' ? 'नयाँ खाता (Create ID)' : 'Create ID'}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('admin');
              setError('');
              setSuccess('');
            }}
            className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer ${
              mode === 'admin'
                ? 'border-purple-600 text-purple-700 bg-white font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {lang === 'ne' ? 'प्रशासन (Admin)' : 'Admin Portal'}
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{success}</span>
            </div>
          )}

          {mode !== 'forgot' && mode !== 'admin' && (
            <>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Google मार्फत सिधै लगइन गर्नुहोस्</span>
              </button>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-slate-200 w-full"></div>
                <span className="bg-white px-3 text-[10px] text-slate-400 uppercase font-medium">
                  {lang === 'ne' ? 'वा इमेल/पासवर्ड' : 'or with email/password'}
                </span>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <>
                {/* Registration Mode Choice (New vs Existing) */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setRegistrationType('EXISTING_LINK')}
                    className={`py-2 px-2.5 rounded-lg text-[11px] font-bold text-center cursor-pointer transition-all ${
                      registrationType === 'EXISTING_LINK'
                        ? 'bg-white text-sky-800 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    पहिले नै धारा छ (Link Tap)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegistrationType('NEW_CONNECTION')}
                    className={`py-2 px-2.5 rounded-lg text-[11px] font-bold text-center cursor-pointer transition-all ${
                      registrationType === 'NEW_CONNECTION'
                        ? 'bg-white text-sky-800 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    नयाँ धारा आवेदन (New Tap)
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'ne' ? 'उपभोक्ताको पूरा नाम' : 'Consumer Full Name'} *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder={lang === 'ne' ? 'जस्तै: राम कुमार श्रेष्ठ' : 'e.g. Ram Kumar Shrestha'}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'ne' ? 'सम्पर्क मोबाइल नम्बर' : 'Mobile Phone Number'} *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="tel"
                      required
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="98XXXXXXXX"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                {registrationType === 'EXISTING_LINK' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {lang === 'ne' ? 'स्थायी ग्राहक कोड (Customer ID)' : 'Customer Code (ID)'} *
                    </label>
                    <input
                      type="text"
                      required
                      value={customerCode}
                      onChange={(e) => setCustomerCode(e.target.value)}
                      placeholder="e.g. HYT-00101"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 uppercase font-mono font-bold"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      {lang === 'ne'
                        ? 'समितिको रसिदमा छापिएको स्थायी ग्राहक कोड र दर्ता गरिएको मोबाइल नम्बर राख्नुहोस्।'
                        : 'Enter your Customer ID as printed on your committee receipts.'}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          {lang === 'ne' ? 'वडा नम्बर' : 'Ward No'} *
                        </label>
                        <select
                          value={ward}
                          onChange={(e) => setWard(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        >
                          <option value="1">वडा नं १ (Ward 1)</option>
                          <option value="2">वडा नं २ (Ward 2)</option>
                          <option value="3">वडा नं ३ (Ward 3)</option>
                          <option value="4">वडा नं ४ (Ward 4)</option>
                          <option value="5">वडा नं ५ (Ward 5)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          {lang === 'ne' ? 'टोल / बस्ती' : 'Tole'}
                        </label>
                        <input
                          type="text"
                          value={tole}
                          onChange={(e) => setTole(e.target.value)}
                          placeholder="उदा: धारापानी"
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {lang === 'ne' ? 'पूरा ठेगाना' : 'Full Address'}
                      </label>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="उदा: धारापानी, वडा नं १, हायुटार"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                      />
                    </div>
                  </>
                )}
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {lang === 'ne' ? 'इमेल ठेगाना (Login Email)' : 'Email Address'} *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    {lang === 'ne' ? 'गोप्य पासवर्ड' : 'Password'} *
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setError('');
                        setSuccess('');
                      }}
                      className="text-[11px] text-sky-700 hover:underline cursor-pointer"
                    >
                      {lang === 'ne' ? 'पासवर्ड बिर्सनुभयो?' : 'Forgot password?'}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
            )}

            {mode === 'admin' && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed flex items-start gap-1.5">
                <Shield className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  {lang === 'ne'
                    ? 'अधिकृत मुख्य एडमिन (hayutarkhanepani@gmail.com) तथा अधिकृत कर्मचारीबाट मात्र प्रशासनिक पहुँच हुन्छ।'
                    : 'Super Admin & Staff roles are verified on the server side against authorized committee credentials.'}
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2.5 rounded-xl font-bold text-xs text-white shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 ${
                mode === 'admin'
                  ? 'bg-purple-700 hover:bg-purple-800'
                  : 'bg-sky-600 hover:bg-sky-700'
              }`}
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  <span>
                    {mode === 'login'
                      ? (lang === 'ne' ? 'लगइन गर्नुहोस्' : 'Sign In')
                      : mode === 'admin'
                      ? (lang === 'ne' ? 'प्रशासन लगइन' : 'Admin Sign In')
                      : mode === 'forgot'
                      ? (lang === 'ne' ? 'पासवर्ड रिसेट लिङ्क पठाउनुहोस्' : 'Send Recovery Link')
                      : (lang === 'ne' ? 'खाता सिर्जना गर्नुहोस्' : 'Create Account')}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {mode === 'forgot' && (
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-xs text-slate-600 hover:underline cursor-pointer"
                >
                  ← Back to Login
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
