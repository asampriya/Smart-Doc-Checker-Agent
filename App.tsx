import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Upload, FileText, Shield, AlertTriangle, DollarSign, Bot, CheckCircle, Users, History, GitBranch } from 'lucide-react';
import { DocumentUpload } from './components/DocumentUpload';
import { DocumentLibrary } from './components/DocumentLibrary';
import { ConflictAnalysis } from './components/ConflictAnalysis';
import { ComplianceMonitor } from './components/ComplianceMonitor';
import { BillingDashboard } from './components/BillingDashboard';
import { TeamCollaboration } from './components/TeamCollaboration';
import { DocumentVersioning } from './components/DocumentVersioning';
import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './utils/supabase/info';

const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
);

interface Document {
  id: string;
  name: string;
  type: 'resume' | 'medical' | 'policy' | 'note' | 'contract' | 'other';
  uploadDate: string;
  status: 'processing' | 'analyzed' | 'error';
  conflicts?: number;
  url?: string;
  version?: number;
  teamId?: string;
  lastModified?: string;
  modifiedBy?: string;
  aiSummary?: string;
  confidence?: number;
}

interface Conflict {
  id: string;
  type: 'policy' | 'compliance' | 'ambiguity';
  severity: 'low' | 'medium' | 'high';
  description: string;
  documents: string[];
  recommendation: string;
  status: 'unresolved' | 'resolved';
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  joinedAt: string;
}

export default function App() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData();
      }
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async () => {
    try {
      // Load documents and conflicts from backend
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-c5e20b83/documents`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
        setConflicts(data.conflicts || []);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleSignIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      console.error('Sign in error:', error);
      return false;
    }
    
    return true;
  };

  const handleSignUp = async (email: string, password: string, name: string) => {
    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-c5e20b83/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ email, password, name }),
      });

      if (response.ok) {
        // Now sign in
        return await handleSignIn(email, password);
      } else {
        const error = await response.text();
        console.error('Sign up error:', error);
        return false;
      }
    } catch (error) {
      console.error('Sign up error:', error);
      return false;
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setDocuments([]);
    setConflicts([]);
  };

  const handleDocumentUpload = async (file: File, type: string) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-c5e20b83/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setDocuments(prev => [...prev, data.document]);
        // Reload data to get updated conflicts
        setTimeout(loadUserData, 2000); // Give AI time to process
      } else {
        console.error('Upload error:', await response.text());
      }
    } catch (error) {
      console.error('Upload error:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-96">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-4">
              <Bot className="w-8 h-8 text-primary-foreground" />
            </div>
            <CardTitle>Smart Doc Checker Agent</CardTitle>
            <CardDescription>
              AI-powered document verification and team collaboration platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AuthForm onSignIn={handleSignIn} onSignUp={handleSignUp} />
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalDocuments = documents.length;
  const unresolvedConflicts = conflicts.filter(c => c.status === 'unresolved').length;
  const processingDocuments = documents.filter(d => d.status === 'processing').length;
  const highSeverityConflicts = conflicts.filter(c => c.severity === 'high' && c.status === 'unresolved').length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Bot className="w-8 h-8 text-primary mr-3" />
              <h1 className="text-foreground">Smart Doc Checker Agent</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">Welcome, {user.email}</span>
              <Button variant="outline" onClick={handleSignOut}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Overview */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <FileText className="w-8 h-8 text-primary" />
                <div className="ml-4">
                  <p className="text-sm text-muted-foreground">Total Documents</p>
                  <p className="text-2xl text-foreground">{totalDocuments}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <AlertTriangle className="w-8 h-8 text-orange-500" />
                <div className="ml-4">
                  <p className="text-sm text-muted-foreground">Unresolved Conflicts</p>
                  <p className="text-2xl text-foreground">{unresolvedConflicts}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Shield className="w-8 h-8 text-red-500" />
                <div className="ml-4">
                  <p className="text-sm text-muted-foreground">High Priority Issues</p>
                  <p className="text-2xl text-foreground">{highSeverityConflicts}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Upload className="w-8 h-8 text-emerald-500" />
                <div className="ml-4">
                  <p className="text-sm text-muted-foreground">Processing</p>
                  <p className="text-2xl text-foreground">{processingDocuments}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="upload" className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="versions">Versions</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload">
            <DocumentUpload onUpload={handleDocumentUpload} />
          </TabsContent>
          
          <TabsContent value="documents">
            <DocumentLibrary documents={documents} onRefresh={loadUserData} />
          </TabsContent>
          
          <TabsContent value="analysis">
            <ConflictAnalysis conflicts={conflicts} documents={documents} onRefresh={loadUserData} />
          </TabsContent>
          
          <TabsContent value="compliance">
            <ComplianceMonitor onRefresh={loadUserData} />
          </TabsContent>
          
          <TabsContent value="team">
            <TeamCollaboration teamMembers={teamMembers} onRefresh={loadUserData} />
          </TabsContent>
          
          <TabsContent value="versions">
            <DocumentVersioning documents={documents} onRefresh={loadUserData} />
          </TabsContent>
          
          <TabsContent value="billing">
            <BillingDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Auth Form Component
function AuthForm({ onSignIn, onSignUp }: { onSignIn: (email: string, password: string) => Promise<boolean>, onSignUp: (email: string, password: string, name: string) => Promise<boolean> }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      let success;
      if (isSignUp) {
        success = await onSignUp(email, password, name);
      } else {
        success = await onSignIn(email, password);
      }
      
      if (!success) {
        alert('Authentication failed. Please try again.');
      }
    } catch (error) {
      console.error('Auth error:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isSignUp && (
        <div>
          <label className="block text-sm mb-1 text-foreground">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-input-background text-foreground"
            required
          />
        </div>
      )}
      
      <div>
        <label className="block text-sm mb-1 text-foreground">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-input-background text-foreground"
          required
        />
      </div>
      
      <div>
        <label className="block text-sm mb-1 text-foreground">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-input-background text-foreground"
          required
        />
      </div>
      
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Please wait...' : (isSignUp ? 'Sign Up' : 'Sign In')}
      </Button>
      
      <div className="text-center">
        <button
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-sm text-primary hover:underline"
        >
          {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
        </button>
      </div>
    </form>
  );
}