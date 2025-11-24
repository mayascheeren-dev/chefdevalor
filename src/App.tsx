import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { 
  Calculator, Settings, Plus, Trash2, Package, Clock, ChefHat, 
  Sparkles, ShoppingCart, Calendar, TrendingUp, LogOut, Copy, Check, Menu, X, 
  Save, Edit, Users, Cake, Phone, User, DollarSign, AlertCircle, ChevronRight
} from 'lucide-react';

// --- 🔒 CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyBvHMHh6jkinWx4K1bKii2eI4SoGkAyqFo",
  authDomain: "chef-de-valor.firebaseapp.com",
  projectId: "chef-de-valor",
  storageBucket: "chef-de-valor.firebasestorage.app",
  messagingSenderId: "401607199442",
  appId: "1:401607199442:web:eed83f4608c5db05d5fb0b",
  measurementId: "G-JR8Z43E95X"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// --- TIPOS ---
interface Ingredient { id: number; name: string; packageWeight: number; cost: number; }
interface RecipeIngredient { id: number; qty: number; }
interface Recipe { id: number; name: string; yields: number; time: number; profit: number; ingredients: RecipeIngredient[] }
interface Client { id: number; name: string; phone: string; birthday: string; }
interface Order { 
  id: number; clientId: number; clientName: string; deliveryDate: string; 
  items: string; value: number; paymentMethod: string; status: string; 
}
interface CompanyProfile { businessName: string; chefName: string; cnpj: string; }
interface ShoppingItem { type: 'recipe' | 'ingredient'; id: number; count: number; }

// --- DADOS INICIAIS ---
const initialIngredients: Ingredient[] = [
  { id: 1, name: 'Leite Condensado', packageWeight: 395, cost: 5.50 },
  { id: 2, name: 'Creme de Leite', packageWeight: 200, cost: 3.20 },
  { id: 3, name: 'Chocolate 50%', packageWeight: 1000, cost: 35.00 },
  { id: 4, name: 'Manteiga', packageWeight: 200, cost: 12.00 },
];

const App = () => {
  // --- ESTADOS GERAIS ---
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [view, setView] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loginError, setLoginError] = useState('');
  
  // --- PERSISTÊNCIA ---
  const [config, setConfig] = useState(() => JSON.parse(localStorage.getItem('cv_config') || '{"salary":3000,"costs":800,"hours":8,"days":5}'));
  const [dbIngredients, setDbIngredients] = useState<Ingredient[]>(() => JSON.parse(localStorage.getItem('cv_ingredients') || JSON.stringify(initialIngredients)));
  const [recipes, setRecipes] = useState<Recipe[]>(() => JSON.parse(localStorage.getItem('cv_recipes') || '[]'));
  const [clients, setClients] = useState<Client[]>(() => JSON.parse(localStorage.getItem('cv_clients') || '[]'));
  const [orders, setOrders] = useState<Order[]>(() => JSON.parse(localStorage.getItem('cv_orders') || '[]'));
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(() => JSON.parse(localStorage.getItem('cv_profile') || '{"businessName":"","chefName":"","cnpj":""}'));

  // --- ESTADOS DE FORMULÁRIOS ---
  const [activeRecipe, setActiveRecipe] = useState<any>(null);
  const [currentRecipe, setCurrentRecipe] = useState<any>({ id: 0, name: '', yields: 1, time: 60, profit: 30, ingredients: [] });
  const [isEditingRecipe, setIsEditingRecipe] = useState(false);

  const [newIngredient, setNewIngredient] = useState({ name: '', packageWeight: '', cost: '' });
  const [editingIngredient, setEditingIngredient] = useState<any>(null);
  
  const [newOrder, setNewOrder] = useState({ clientId: '', deliveryDate: '', items: '', value: '', paymentMethod: 'Pix' });
  const [newClient, setNewClient] = useState({ name: '', phone: '', birthday: '' });

  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);

  // Efeitos
  useEffect(() => { localStorage.setItem('cv_config', JSON.stringify(config)); }, [config]);
  useEffect(() => { localStorage.setItem('cv_ingredients', JSON.stringify(dbIngredients)); }, [dbIngredients]);
  useEffect(() => { localStorage.setItem('cv_recipes', JSON.stringify(recipes)); }, [recipes]);
  useEffect(() => { localStorage.setItem('cv_clients', JSON.stringify(clients)); }, [clients]);
  useEffect(() => { localStorage.setItem('cv_orders', JSON.stringify(orders)); }, [orders]);
  useEffect(() => { localStorage.setItem('cv_profile', JSON.stringify(companyProfile)); }, [companyProfile]);
  
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setLoadingAuth(false); });
    return () => unsub();
  }, []);

  // --- LÓGICA FINANCEIRA ---
  const formatMoney = (v: any) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  
  const getHourlyRate = () => {
    const totalHours = parseFloat(config.hours) * parseFloat(config.days) * 4.28;
    const totalCost = parseFloat(config.salary) + parseFloat(config.costs);
    return totalHours ? totalCost / totalHours : 0;
  };

  const calculateRecipe = (rec: any) => {
    let matCost = 0;
    rec.ingredients.forEach((i: any) => {
      const ing = dbIngredients.find(d => d.id === i.id);
      if (ing) matCost += (ing.cost / ing.packageWeight) * i.qty;
    });
    const varCost = matCost * 0.10; 
    const laborCost = (rec.time / 60) * getHourlyRate();
    const totalCost = matCost + varCost + laborCost;
    const finalPrice = totalCost * (1 + (rec.profit / 100));
    return { totalCost, finalPrice, unitPrice: finalPrice / (rec.yields || 1) };
  };

  // Lista de Compras
  const shoppingStats = useMemo(() => {
    const totals: any = {};
    let totalCost = 0;

    shoppingList.forEach(item => {
      if (item.count > 0) {
        if (item.type === 'recipe') {
          const rec = recipes.find(r => r.id === item.id);
          rec?.ingredients.forEach((ing: any) => {
            const dbIng = dbIngredients.find(d => d.id === ing.id);
            if (dbIng) {
              const q = ing.qty * item.count;
              const c = (dbIng.cost / dbIng.packageWeight) * q;
              if (!totals[dbIng.name]) totals[dbIng.name] = {qty:0, cost:0, unit: 'g'};
              totals[dbIng.name].qty += q;
              totals[dbIng.name].cost += c;
              totalCost += c;
            }
          });
        } else {
          const dbIng = dbIngredients.find(d => d.id === item.id);
          if (dbIng) {
            const q = dbIng.packageWeight * item.count;
            const c = dbIng.cost * item.count;
            if (!totals[dbIng.name]) totals[dbIng.name] = {qty:0, cost:0, unit: 'g'};
            totals[dbIng.name].qty += q;
            totals[dbIng.name].cost += c;
            totalCost += c;
          }
        }
      }
    });
    return { totals, totalCost };
  }, [shoppingList, recipes, dbIngredients]);

  // --- AÇÕES ---
  const handleLogin = async (e: any) => { 
      e.preventDefault(); 
      setLoginError('');
      try { await signInWithEmailAndPassword(auth, email, password); } 
      catch (e) { setLoginError("Dados incorretos."); } 
  };

  const handleDeleteIngredient = (id: number) => {
      const isUsed = recipes.some(r => r.ingredients.some((i: any) => i.id === id));
      if(isUsed && !window.confirm("Ingrediente em uso. Continuar?")) return;
      if(!isUsed && !window.confirm("Apagar ingrediente?")) return;
      setDbIngredients(dbIngredients.filter(i => i.id !== id));
  };

  const handleSaveRecipe = () => {
      if (!currentRecipe.name) return alert("Dê um nome para a receita!");
      
      if (isEditingRecipe) {
          setRecipes(recipes.map(r => r.id === currentRecipe.id ? currentRecipe : r));
          alert("Receita atualizada!");
          setIsEditingRecipe(false);
      } else {
          setRecipes([...recipes, {...currentRecipe, id: Date.now()}]);
          alert("Receita salva!");
      }
      setCurrentRecipe({ id: 0, name: '', yields: 1, time: 60, profit: 30, ingredients: [] });
      setActiveRecipe(null);
  };

  const handleEditRecipe = (rec: any) => {
      setCurrentRecipe(rec);
      setIsEditingRecipe(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setActiveRecipe(rec); 
  };

  const handleDeleteRecipe = (id: number) => {
      if(window.confirm("Excluir receita?")) setRecipes(recipes.filter(r => r.id !== id));
  };

  const handleAddIngredient = () => {
    if (newIngredient.name && newIngredient.cost) {
        setDbIngredients([...dbIngredients, { id: Date.now(), name: newIngredient.name, packageWeight: Number(newIngredient.packageWeight), cost: Number(newIngredient.cost) }]);
        setNewIngredient({ name: '', packageWeight: '', cost: '' });
    }
  };

  const handleUpdateIngredient = () => {
      if(editingIngredient) {
          setDbIngredients(dbIngredients.map(ing => ing.id === editingIngredient.id ? editingIngredient : ing));
          setEditingIngredient(null);
      }
  };

  const handleAddClient = () => {
    if (newClient.name) {
        setClients([...clients, { id: Date.now(), ...newClient }]);
        setNewClient({ name: '', phone: '', birthday: '' });
        alert('Cliente cadastrado!');
    }
  };

  const handleAddOrder = () => {
      if (newOrder.clientId && newOrder.value) {
          const client = clients.find(c => c.id === Number(newOrder.clientId));
          setOrders([...orders, {
              id: Date.now(),
              clientId: Number(newOrder.clientId),
              clientName: client ? client.name : 'Desconhecido',
              deliveryDate: newOrder.deliveryDate,
              items: newOrder.items,
              value: Number(newOrder.value),
              paymentMethod: newOrder.paymentMethod,
              status: 'pendente'
          }]);
          setNewOrder({ clientId: '', deliveryDate: '', items: '', value: '', paymentMethod: 'Pix' });
          alert('Agendado!');
      } else alert("Preencha os dados.");
  };

  const confirmPayment = (orderId: number) => {
      if(window.confirm("Confirmar pagamento?")) {
          setOrders(orders.map(o => o.id === orderId ? {...o, status: 'pago'} : o));
      }
  };

  const handleAddToShoppingList = (type: 'recipe'|'ingredient', id: number, delta: number) => {
      setShoppingList(prev => {
          const existing = prev.find(i => i.type === type && i.id === id);
          if (existing) {
              const newCount = existing.count + delta;
              if (newCount <= 0) return prev.filter(i => !(i.type === type && i.id === id)); 
              return prev.map(i => i.type === type && i.id === id ? {...i, count: newCount} : i);
          }
          if (delta > 0) return [...prev, {type, id, count: delta}];
          return prev;
      });
  };

  const generateShoppingListText = () => {
    let text = `*🛒 Lista de Compras - ${companyProfile.businessName || 'Chef de Valor'}*\n\n`;
    Object.entries(shoppingStats.totals).forEach(([name, data]: any) => {
        text += `▫️ ${name}: ${data.qty.toFixed(0)}g (~${formatMoney(data.cost)})\n`;
    });
    text += `\n*💰 Previsão Total: ${formatMoney(shoppingStats.totalCost)}*`;
    return text;
  };

  const handleAiGenerate = () => {
    setIsAiLoading(true);
    setTimeout(() => {
        setAiResponse(`✨ **Sugestão de Legenda:**\n\n"Atenção formiguinhas! 🐜\n\nO nosso ${aiPrompt || 'doce'} acabou de sair da produção e está imperdível. Feito com ingredientes premium para adoçar sua semana.\n\n📲 Peça pelo link na bio!\n#${companyProfile.businessName?.replace(/\s/g, '') || 'ConfeitariaArtesanal'} #ChefDeValor"`);
        setIsAiLoading(false);
    }, 2000);
  };

  if (loadingAuth) return <div className="min-h-screen flex items-center justify-center bg-[#FDF6F0] text-[#C58945] font-bold">Carregando...</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDF6F0] p-6 font-serif">
        <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl border border-[#E8DED5]">
          <div className="text-center mb-8">
            <div className="bg-[#4A3630] text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg"><ChefHat size={32} /></div>
            <h1 className="text-3xl font-bold text-[#4A3630]">Chef de Valor</h1>
            <p className="text-[#8D6E63]">Login Seguro</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-4 bg-[#FAFAFA] border border-[#E8DED5] rounded-xl text-[#4A3630]" required />
            <input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-4 bg-[#FAFAFA] border border-[#E8DED5] rounded-xl text-[#4A3630]" required />
            {loginError && <p className="text-red-500 text-sm text-center">{loginError}</p>}
            <button type="submit" className="w-full bg-[#4A3630] text-white p-4 rounded-xl font-bold hover:bg-[#382823] transition-colors">ENTRAR AGORA</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDF6F0] font-sans text-[#4A3630] flex flex-col md:flex-row">
       
       {/* MODAL EDIÇÃO INGREDIENTE */}
       {editingIngredient && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
              <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md border border-[#E8DED5]">
                  <h3 className="text-xl font-bold mb-4 text-[#4A3630]">Editar: {editingIngredient.name}</h3>
                  <div className="space-y-4">
                      <div><label className="text-xs font-bold uppercase text-[#8D6E63]">Preço Pago (R$)</label><input type="number" value={editingIngredient.cost} onChange={e => setEditingIngredient({...editingIngredient, cost: Number(e.target.value)})} className="w-full p-3 border border-[#E8DED5] rounded-xl" /></div>
                      <div><label className="text-xs font-bold uppercase text-[#8D6E63]">Peso da Embalagem (g/ml)</label><input type="number" value={editingIngredient.packageWeight} onChange={e => setEditingIngredient({...editingIngredient, packageWeight: Number(e.target.value)})} className="w-full p-3 border border-[#E8DED5] rounded-xl" /></div>
                  </div>
                  <div className="mt-6 flex justify-end gap-3">
                      <button onClick={() => setEditingIngredient(null)} className="bg-gray-100 text-gray-600 px-4 py-2 rounded-xl font-bold">Cancelar</button>
                      <button onClick={handleUpdateIngredient} className="bg-[#C58945] text-white px-4 py-2 rounded-xl font-bold">Salvar</button>
                  </div>
              </div>
          </div>
      )}

      {/* SIDEBAR */}
      <div className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#4A3630] text-[#FDF6F0] transform ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 shadow-2xl flex flex-col`}>
        <div className="p-6 border-b border-[#5D443C]">
            <h1 className="font-serif text-xl font-bold text-[#C58945] truncate">{companyProfile.businessName || 'Chef de Valor'}</h1>
            <p className="text-xs opacity-70 truncate">Olá, {companyProfile.chefName || 'Chef'}!</p>
            <button onClick={() => setMobileMenuOpen(false)} className="absolute top-4 right-4 md:hidden text-white"><X/></button>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
            {[
                { id: 'dashboard', label: 'Visão Geral', icon: TrendingUp },
                { id: 'profile', label: 'Minha Empresa', icon: User },
                { id: 'calculator', label: 'Precificação & Receitas', icon: Calculator },
                { id: 'ingredients', label: 'Minha Despensa', icon: Package },
                { id: 'shopping', label: 'Lista de Compras', icon: ShoppingCart },
                { id: 'orders', label: 'Agenda de Pedidos', icon: Calendar },
                { id: 'clients', label: 'Clientes', icon: Users },
                { id: 'config', label: 'Configurações', icon: Settings },
            ].map(item => (
                <button key={item.id} onClick={() => { setView(item.id); setMobileMenuOpen(false); setActiveRecipe(null); }} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${view === item.id ? 'bg-[#C58945] text-white shadow-md' : 'hover:bg-[#5D443C] text-[#E8DED5]'}`}>
                    <item.icon size={18} /> <span className="font-medium">{item.label}</span>
                </button>
            ))}
        </nav>
        <div className="p-4 border-t border-[#5D443C]">
            <button onClick={() => signOut(auth)} className="w-full flex items-center justify-center gap-2 text-[#D48C95] hover:text-white transition-colors text-sm font-bold py-2"><LogOut size={16} /> Sair</button>
        </div>
      </div>

      {/* CONTEÚDO PRINCIPAL */}
      <div className="flex-1 md:ml-64 min-h-screen flex flex-col">
        <div className="md:hidden bg-white p-4 flex justify-between items-center shadow-sm sticky top-0 z-30">
            <button onClick={() => setMobileMenuOpen(true)} className="text-[#4A3630]"><Menu/></button>
            <span className="font-serif font-bold text-[#C58945] truncate ml-2">{companyProfile.businessName || 'Chef de Valor'}</span>
            <div className="w-6"></div>
        </div>

        <div className="p-4 md:p-8 max-w-6xl mx-auto w-full pb-20">
            
            {/* DASHBOARD */}
            {view === 'dashboard' && (
                <div className="space-y-6 animate-fade-in">
                    <h2 className="text-3xl font-serif font-bold text-[#4A3630]">Olá, {companyProfile.chefName || 'Chef'}! 👋</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#E8DED5]">
                            <p className="text-xs text-[#8D6E63] font-bold uppercase tracking-wide">Faturamento (Mês)</p>
                            <p className="text-3xl font-serif font-bold text-[#2E7D32]">{formatMoney(orders.reduce((acc: number, o: any) => o.status !== 'pendente' ? acc + o.value : acc, 0))}</p>
                        </div>
                        <div className="bg-[#C58945] text-white p-6 rounded-3xl shadow-lg">
                            <p className="text-xs opacity-90 font-bold uppercase tracking-wide">A Receber (Pendente)</p>
                            <p className="text-3xl font-serif font-bold">{formatMoney(orders.reduce((acc: number, o: any) => o.status === 'pendente' ? acc + o.value : acc, 0))}</p>
                        </div>
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#E8DED5]">
                            <p className="text-xs text-[#8D6E63] font-bold uppercase tracking-wide">Aniversariantes do Mês</p>
                            <p className="text-3xl font-serif font-bold text-[#D48C95]">{clients.filter((c: any) => c.birthday && parseInt(c.birthday.split('-')[1]) === new Date().getMonth() + 1).length}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* CALCULADORA & RECEITAS (COM LISTA ABAIXO) */}
            {view === 'calculator' && (
                <div className="space-y-8 animate-fade-in">
                    {/* Formulário */}
                    <div className="grid lg:grid-cols-2 gap-8">
                         <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#E8DED5] space-y-4">
                            <div className="flex justify-between items-center mb-2">
                                <h2 className="text-xl font-bold text-[#4A3630] flex items-center gap-2"><Calculator className="text-[#C58945]"/> {isEditingRecipe ? 'Editar Receita' : 'Nova Precificação'}</h2>
                                {isEditingRecipe && <button onClick={() => { setIsEditingRecipe(false); setCurrentRecipe({ id: 0, name: '', yields: 1, time: 60, profit: 30, ingredients: [] }); }} className="text-xs text-[#8D6E63] border px-2 py-1 rounded hover:bg-gray-50">Cancelar Edição</button>}
                            </div>
                            <div><label className="text-xs font-bold text-[#8D6E63]">NOME DA RECEITA</label><input value={currentRecipe.name} onChange={e => setCurrentRecipe({...currentRecipe, name: e.target.value})} className="w-full p-3 bg-[#FAFAFA] border border-[#E8DED5] rounded-xl font-bold text-[#4A3630]" placeholder="Ex: Bolo de Cenoura"/></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-[#8D6E63]">RENDIMENTO</label><input type="number" value={currentRecipe.yields} onChange={e => setCurrentRecipe({...currentRecipe, yields: Number(e.target.value)})} className="w-full p-3 bg-[#FAFAFA] border border-[#E8DED5] rounded-xl"/></div>
                                <div><label className="text-xs font-bold text-[#8D6E63]">TEMPO (MIN)</label><input type="number" value={currentRecipe.time} onChange={e => setCurrentRecipe({...currentRecipe, time: Number(e.target.value)})} className="w-full p-3 bg-[#FAFAFA] border border-[#E8DED5] rounded-xl"/></div>
                            </div>
                            <div className="pt-4 border-t border-dashed border-[#E8DED5]">
                                <label className="text-xs font-bold text-[#8D6E63] mb-2 block">INGREDIENTES</label>
                                <select className="w-full p-3 bg-[#FAFAFA] border border-[#E8DED5] rounded-xl mb-3 cursor-pointer" onChange={e => {
                                    const id = Number(e.target.value);
                                    if(!currentRecipe.ingredients.find(i => i.id === id)) setCurrentRecipe({...currentRecipe, ingredients: [...currentRecipe.ingredients, {id, qty: 0}]});
                                }} value="">
                                    <option value="" disabled>+ Adicionar da Despensa</option>
                                    {dbIngredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                </select>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {currentRecipe.ingredients.map(ing => {
                                        const db = dbIngredients.find(d => d.id === ing.id);
                                        if(!db) return null;
                                        return (
                                            <div key={ing.id} className="flex items-center gap-2 bg-[#FDF6F0] p-2 rounded-xl">
                                                <div className="flex-1 text-sm font-bold truncate">{db.name}</div>
                                                <input type="number" value={ing.qty} onChange={e => {
                                                    const newIngs = currentRecipe.ingredients.map(i => i.id === ing.id ? {...i, qty: Number(e.target.value)} : i);
                                                    setCurrentRecipe({...currentRecipe, ingredients: newIngs});
                                                }} className="w-20 p-1 bg-white border rounded text-right"/>
                                                <span className="text-xs text-[#8D6E63]">g</span>
                                                <button onClick={() => setCurrentRecipe({...currentRecipe, ingredients: currentRecipe.ingredients.filter(i => i.id !== ing.id)})} className="text-[#D48C95] hover:text-red-500 p-1"><Trash2 size={14}/></button>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                         </div>

                         <div className="space-y-6">
                            <div className="bg-[#4A3630] text-[#FDF6F0] p-8 rounded-3xl shadow-xl">
                                <p className="text-sm opacity-70 uppercase tracking-widest mb-1">Preço de Venda (Unidade)</p>
                                <p className="text-5xl font-serif font-bold text-[#C58945] mb-6">{formatMoney(calculateRecipe(currentRecipe).unitPrice)}</p>
                                <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4 text-sm">
                                    <div><p className="opacity-50">Custo Total</p><p className="font-bold">{formatMoney(calculateRecipe(currentRecipe).totalCost)}</p></div>
                                    <div><p className="opacity-50">Lucro Líquido</p><p className="font-bold text-[#4ADE80]">+{formatMoney(calculateRecipe(currentRecipe).finalPrice - calculateRecipe(currentRecipe).totalCost)}</p></div>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#E8DED5]">
                                <div className="flex justify-between mb-2"><span className="font-bold text-[#4A3630]">Margem de Lucro</span><span className="font-bold text-[#C58945]">{currentRecipe.profit}%</span></div>
                                <input type="range" min="0" max="300" value={currentRecipe.profit} onChange={e => setCurrentRecipe({...currentRecipe, profit: Number(e.target.value)})} className="w-full accent-[#C58945]"/>
                                <button onClick={handleSaveRecipe} className="w-full mt-6 bg-[#C58945] text-white p-4 rounded-xl font-bold hover:bg-[#B0783A] transition-colors flex items-center justify-center gap-2 shadow-md">
                                    <Save size={20}/> {isEditingRecipe ? 'Atualizar' : 'Salvar na Biblioteca'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Lista de Receitas Salvas */}
                    <div className="border-t border-[#E8DED5] pt-8">
                        <h3 className="text-2xl font-serif font-bold text-[#4A3630] mb-4 flex items-center gap-2"><Package size={24}/> Minhas Receitas Salvas</h3>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {recipes.length === 0 && <p className="col-span-3 text-center text-[#8D6E63] opacity-50 italic py-8">Nenhuma receita salva ainda.</p>}
                            {recipes.map((r: any) => {
                                const calc = calculateRecipe(r);
                                return (
                                    <div key={r.id} className="bg-white p-5 rounded-2xl border border-[#E8DED5] hover:shadow-md transition-all group relative">
                                        <div className="flex justify-between items-start mb-3">
                                            <h4 className="font-bold text-lg text-[#4A3630] line-clamp-1">{r.name}</h4>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleEditRecipe(r)} className="text-[#C58945] hover:bg-[#FDF6F0] p-1 rounded"><Edit size={16}/></button>
                                                <button onClick={() => handleDeleteRecipe(r.id)} className="text-[#D48C95] hover:bg-[#FDF6F0] p-1 rounded"><Trash2 size={16}/></button>
                                            </div>
                                        </div>
                                        <div className="flex justify-between text-sm text-[#8D6E63] mb-2">
                                            <span>Custo: {formatMoney(calc.totalCost)}</span>
                                            <span className="font-bold text-[#C58945] text-lg">{formatMoney(calc.unitPrice)}</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* --- DESPENSA (COM EXCLUSÃO) --- */}
            {view === 'ingredients' && (
                <div className="space-y-6 animate-fade-in">
                    <h2 className="text-2xl font-serif font-bold text-[#4A3630]">Minha Despensa</h2>
                    <div className="bg-[#FDF6F0] p-4 rounded-2xl flex flex-col md:flex-row gap-2 items-end border border-[#E8DED5]">
                        <div className="flex-1 w-full"><label className="text-xs font-bold text-[#8D6E63]">Nome</label><input className="w-full p-2 rounded-lg border" value={newIngredient.name} onChange={e => setNewIngredient({...newIngredient, name: e.target.value})} /></div>
                        <div className="w-24"><label className="text-xs font-bold text-[#8D6E63]">Peso (g)</label><input type="number" className="w-full p-2 rounded-lg border" value={newIngredient.packageWeight} onChange={e => setNewIngredient({...newIngredient, packageWeight: Number(e.target.value)})} /></div>
                        <div className="w-24"><label className="text-xs font-bold text-[#8D6E63]">Preço</label><input type="number" className="w-full p-2 rounded-lg border" value={newIngredient.cost} onChange={e => setNewIngredient({...newIngredient, cost: Number(e.target.value)})} /></div>
                        <button onClick={handleAddIngredient} className="bg-[#C58945] text-white p-2 rounded-lg mb-[1px]"><Plus/></button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {dbIngredients.map(ing => (
                            <div key={ing.id} className="bg-white p-4 rounded-xl border border-[#E8DED5] flex justify-between items-center shadow-sm">
                                <div><span className="font-bold text-[#4A3630] block">{ing.name}</span><span className="text-xs text-[#8D6E63]">{formatMoney(ing.cost)} / {ing.packageWeight}g</span></div>
                                <div className="flex gap-2">
                                    <button onClick={() => setEditingIngredient(ing)} className="p-2 bg-[#FDF6F0] rounded-lg text-[#C58945]"><Edit size={16}/></button>
                                    <button onClick={() => handleDeleteIngredient(ing.id)} className="p-2 bg-red-50 rounded-lg text-red-500"><Trash2 size={16}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* --- LISTA DE COMPRAS INTELIGENTE --- */}
            {view === 'shopping' && (
                <div className="animate-fade-in grid lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <h2 className="text-2xl font-serif font-bold text-[#4A3630]">Gerador de Lista</h2>
                        
                        <div className="bg-white p-4 rounded-2xl border border-[#E8DED5]">
                            <h3 className="font-bold text-[#C58945] mb-3 text-sm uppercase">Adicionar Receitas</h3>
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                {recipes.map((r: any) => {
                                    const count = shoppingList.find(s => s.type === 'recipe' && s.id === r.id)?.count || 0;
                                    return (
                                        <div key={r.id} className="flex justify-between items-center p-2 border-b border-[#FAFAFA]">
                                            <span className="font-bold text-sm text-[#4A3630]">{r.name}</span>
                                            <div className="flex items-center gap-2">
                                                {count > 0 && <button onClick={() => handleAddToShoppingList('recipe', r.id, -1)} className="w-6 h-6 bg-[#FDF6F0] rounded text-[#4A3630]">-</button>}
                                                {count > 0 && <span className="font-bold text-sm w-4 text-center">{count}</span>}
                                                <button onClick={() => handleAddToShoppingList('recipe', r.id, 1)} className="w-6 h-6 bg-[#4A3630] text-white rounded">+</button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-2xl border border-[#E8DED5]">
                            <h3 className="font-bold text-[#C58945] mb-3 text-sm uppercase">Adicionar Ingrediente Avulso</h3>
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                {dbIngredients.map(ing => {
                                    const count = shoppingList.find(s => s.type === 'ingredient' && s.id === ing.id)?.count || 0;
                                    return (
                                        <div key={ing.id} className="flex justify-between items-center p-2 border-b border-[#FAFAFA]">
                                            <span className="font-bold text-sm text-[#4A3630]">{ing.name}</span>
                                            <div className="flex items-center gap-2">
                                                {count > 0 && <button onClick={() => handleAddToShoppingList('ingredient', ing.id, -1)} className="w-6 h-6 bg-[#FDF6F0] rounded text-[#4A3630]">-</button>}
                                                {count > 0 && <span className="font-bold text-sm w-4 text-center">{count}</span>}
                                                <button onClick={() => handleAddToShoppingList('ingredient', ing.id, 1)} className="w-6 h-6 bg-[#4A3630] text-white rounded">+</button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-[#4A3630]">Resultado (Ingredientes e Valores)</h3>
                            <button onClick={() => { navigator.clipboard.writeText(generateShoppingListText()); alert("Copiado!"); }} className="text-[#C58945] text-sm font-bold flex gap-1 items-center"><Copy size={14}/> Copiar</button>
                        </div>
                        
                        <div className="bg-white p-6 rounded-2xl border border-[#E8DED5] shadow-sm">
                            <table className="w-full text-sm text-left">
                                <thead className="text-[#8D6E63] border-b border-[#E8DED5]">
                                    <tr><th className="pb-2">Item</th><th className="pb-2">Qtd. Total</th><th className="pb-2 text-right">Custo Est.</th></tr>
                                </thead>
                                <tbody className="text-[#4A3630]">
                                    {Object.entries(shoppingStats.totals).map(([name, data]: any) => (
                                        <tr key={name} className="border-b border-[#FAFAFA]">
                                            <td className="py-2 font-bold">{name}</td>
                                            <td className="py-2">{data.qty.toFixed(0)}{data.unit}</td>
                                            <td className="py-2 text-right">{formatMoney(data.cost)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="mt-4 pt-4 border-t border-[#E8DED5] flex justify-between font-bold text-lg">
                                <span>Total Previsto:</span>
                                <span className="text-[#C58945]">{formatMoney(shoppingStats.totalCost)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- CLIENTES, AGENDA, PERFIL, CONFIG, IA (MANTIDOS) --- */}
            {view === 'clients' && <div className="animate-fade-in space-y-6"><h2 className="text-2xl font-serif font-bold text-[#4A3630]">Cadastro de Clientes</h2><div className="bg-white p-6 rounded-2xl border border-[#E8DED5] grid md:grid-cols-3 gap-4 items-end shadow-sm"><div><label className="text-xs font-bold text-[#8D6E63]">Nome</label><input className="w-full p-2 border rounded-lg" value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})}/></div><div><label className="text-xs font-bold text-[#8D6E63]">WhatsApp</label><input className="w-full p-2 border rounded-lg" value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})}/></div><div><label className="text-xs font-bold text-[#8D6E63]">Nascimento</label><input type="date" className="w-full p-2 border rounded-lg" value={newClient.birthday} onChange={e => setNewClient({...newClient, birthday: e.target.value})}/></div><button onClick={handleAddClient} className="bg-[#4A3630] text-white p-2 rounded-lg font-bold md:col-span-3">Cadastrar</button></div><div className="grid md:grid-cols-2 gap-4">{clients.map(c => (<div key={c.id} className="bg-white p-4 rounded-xl border border-[#E8DED5] shadow-sm flex justify-between"><div><p className="font-bold text-[#4A3630] flex items-center gap-2">{c.name} {c.birthday && parseInt(c.birthday.split('-')[1]) === new Date().getMonth() + 1 && <Cake size={14} className="text-[#D48C95]"/>}</p><p className="text-xs text-[#8D6E63]">{c.phone}</p></div><button onClick={() => setClients(clients.filter(x => x.id !== c.id))} className="text-red-400"><Trash2 size={16}/></button></div>))}</div></div>}
            {view === 'orders' && <div className="animate-fade-in space-y-6"><h2 className="text-2xl font-serif font-bold text-[#4A3630]">Agenda</h2><div className="bg-white p-6 rounded-3xl shadow-sm border border-[#E8DED5]"><div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4"><div><label className="text-xs font-bold text-[#8D6E63]">Cliente</label><select value={newOrder.clientId} onChange={e => setNewOrder({...newOrder, clientId: e.target.value})} className="w-full p-2 border rounded-xl bg-[#FAFAFA]"><option value="">Selecione...</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div><label className="text-xs font-bold text-[#8D6E63]">Data</label><input type="date" value={newOrder.deliveryDate} onChange={e => setNewOrder({...newOrder, deliveryDate: e.target.value})} className="w-full p-2 border rounded-xl bg-[#FAFAFA]"/></div><div><label className="text-xs font-bold text-[#8D6E63]">Valor</label><input type="number" value={newOrder.value} onChange={e => setNewOrder({...newOrder, value: e.target.value})} className="w-full p-2 border rounded-xl bg-[#FAFAFA]"/></div><div className="md:col-span-2 lg:col-span-4"><label className="text-xs font-bold text-[#8D6E63]">Descrição</label><input value={newOrder.items} onChange={e => setNewOrder({...newOrder, items: e.target.value})} className="w-full p-2 border rounded-xl bg-[#FAFAFA]"/></div></div><button onClick={handleAddOrder} className="mt-4 w-full bg-[#C58945] text-white p-3 rounded-xl font-bold hover:bg-[#A06825]">Agendar</button></div><div className="grid md:grid-cols-2 gap-6"><div className="bg-[#FFF3E0] p-6 rounded-3xl border border-[#FFE0B2]"><h3 className="font-bold text-[#C58945] mb-4 flex items-center gap-2"><Clock size={18}/> Pendentes</h3><div className="space-y-3">{orders.filter(o => o.status === 'pendente').map(o => (<div key={o.id} className="bg-white p-4 rounded-xl shadow-sm border border-[#FFE0B2]"><div className="flex justify-between items-start mb-2"><div><div className="font-bold text-[#4A3630]">{o.clientName}</div><div className="text-xs text-[#8D6E63]">{o.deliveryDate.split('-').reverse().join('/')}</div></div><div className="text-lg font-bold text-[#C58945]">{formatMoney(o.value)}</div></div><button onClick={() => confirmPayment(o.id)} className="text-xs bg-[#4ADE80] text-[#064E3B] px-3 py-2 rounded-lg font-bold w-full flex justify-center gap-1"><Check size={12}/> Pagar</button></div>))}</div></div><div className="bg-[#E7F7EE] p-6 rounded-3xl border border-[#C8E6C9]"><h3 className="font-bold text-[#2E7D32] mb-4 flex items-center gap-2"><Check size={18}/> Pagos</h3><div className="space-y-3 opacity-70">{orders.filter(o => o.status === 'pago' || o.status === 'entregue').map(o => (<div key={o.id} className="bg-white p-4 rounded-xl shadow-sm border border-[#C8E6C9] flex justify-between"><span className="font-bold text-[#4A3630]">{o.clientName}</span><span className="font-bold text-[#2E7D32]">{formatMoney(o.value)}</span></div>))}</div></div></div></div>}
            {view === 'profile' && <div className="animate-fade-in space-y-6"><h2 className="text-2xl font-serif font-bold text-[#4A3630] flex items-center gap-2"><User className="text-[#C58945]"/> Minha Empresa</h2><div className="bg-white p-8 rounded-3xl shadow-sm border border-[#E8DED5] max-w-2xl"><div className="space-y-4"><div><label className="text-xs font-bold text-[#8D6E63] uppercase">Nome da Confeitaria</label><input value={companyProfile.businessName} onChange={e => setCompanyProfile({...companyProfile, businessName: e.target.value})} className="w-full p-3 bg-[#FAFAFA] border border-[#E8DED5] rounded-xl mt-1"/></div><div><label className="text-xs font-bold text-[#8D6E63] uppercase">Seu Nome (Chef)</label><input value={companyProfile.chefName} onChange={e => setCompanyProfile({...companyProfile, chefName: e.target.value})} className="w-full p-3 bg-[#FAFAFA] border border-[#E8DED5] rounded-xl mt-1"/></div><div><label className="text-xs font-bold text-[#8D6E63] uppercase">CNPJ</label><input value={companyProfile.cnpj} onChange={e => setCompanyProfile({...companyProfile, cnpj: e.target.value})} className="w-full p-3 bg-[#FAFAFA] border border-[#E8DED5] rounded-xl mt-1"/></div></div><button onClick={() => alert('Salvo!')} className="w-full mt-6 bg-[#4A3630] text-white p-4 rounded-xl font-bold hover:bg-[#382823]">Salvar Perfil</button></div></div>}
            {view === 'config' && <div className="bg-white p-8 rounded-3xl shadow-sm border border-[#E8DED5] animate-fade-in max-w-2xl mx-auto"><h2 className="text-xl font-bold text-gray-800 mb-6">Ajustes</h2><div className="grid md:grid-cols-2 gap-6"><div><label className="block text-xs font-bold text-[#8D6E63] uppercase mb-1">Salário</label><input type="number" value={config.salary} onChange={e => setConfig({...config, salary: e.target.value})} className="w-full p-3 bg-[#FAFAFA] border border-[#E8DED5] rounded-xl" /></div><div><label className="block text-xs font-bold text-[#8D6E63] uppercase mb-1">Custos Fixos</label><input type="number" value={config.costs} onChange={e => setConfig({...config, costs: e.target.value})} className="w-full p-3 bg-[#FAFAFA] border border-[#E8DED5] rounded-xl" /></div><div><label className="block text-xs font-bold text-[#8D6E63] uppercase mb-1">Horas/Dia</label><input type="number" value={config.hours} onChange={e => setConfig({...config, hours: e.target.value})} className="w-full p-3 bg-[#FAFAFA] border border-[#E8DED5] rounded-xl" /></div><div><label className="block text-xs font-bold text-[#8D6E63] uppercase mb-1">Dias/Semana</label><input type="number" value={config.days} onChange={e => setConfig({...config, days: e.target.value})} className="w-full p-3 bg-[#FAFAFA] border border-[#E8DED5] rounded-xl" /></div></div></div>}
            {view === 'ai' && <div className="animate-fade-in"><div className="bg-white p-8 rounded-3xl text-center border border-[#E8DED5]"><Sparkles className="mx-auto mb-4 text-[#C58945]" size={40}/><h2 className="text-2xl font-bold mb-2">Marketing IA</h2><div className="space-y-4 text-left"><textarea className="w-full p-4 border rounded-xl" rows={3} placeholder="Sobre o que é o post?" value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}/><button onClick={() => { setIsAiLoading(true); setTimeout(() => { setAiResponse("✨ Legenda gerada com sucesso!"); setIsAiLoading(false); }, 1500); }} className="w-full bg-[#4A3630] text-white p-4 rounded-xl font-bold">{isAiLoading ? 'Criando...' : 'Gerar Legenda'}</button></div>{aiResponse && <div className="mt-6 p-4 bg-[#FDF6F0] rounded-xl text-left relative"><p>{aiResponse}</p><button onClick={() => navigator.clipboard.writeText(aiResponse)} className="absolute top-2 right-2"><Copy size={16}/></button></div>}</div></div>}

        </div>
      </div>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Lato:wght@400;700&display=swap'); .font-serif { font-family: 'Playfair Display', serif; } .font-sans { font-family: 'Lato', sans-serif; } .animate-fade-in { animation: fadeIn 0.3s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
};

export default App;
