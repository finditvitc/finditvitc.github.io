import React from 'react';
import { X, Cloud, Cpu, Database, Eye, Bell, ShieldCheck, HardDrive, CheckCircle2 } from 'lucide-react';

export const AWSArchitectureModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const services = [
    {
      name: 'Amazon S3',
      icon: HardDrive,
      color: 'text-amber-500 bg-amber-50 border-amber-200',
      role: 'Secure Object Storage',
      desc: 'Stores high-resolution item photos. Uses S3 Event Notifications (s3:ObjectCreated) to automatically trigger serverless image analysis.'
    },
    {
      name: 'Amazon Rekognition',
      icon: Eye,
      color: 'text-blue-500 bg-blue-50 border-blue-200',
      role: 'Computer Vision & AI Labeling',
      desc: 'Analyzes item photos on upload using DetectLabels to extract object tags (e.g. backpack, laptop, headphones), dominant colors, and categories.'
    },
    {
      name: 'AWS Lambda',
      icon: Cpu,
      color: 'text-orange-500 bg-orange-50 border-orange-200',
      role: 'Serverless Business Logic',
      desc: 'Executes report creation, queries DynamoDB, runs the AI match scoring engine (Category + Rekognition tags + Location + Text), and triggers SNS alerts.'
    },
    {
      name: 'Amazon DynamoDB',
      icon: Database,
      color: 'text-emerald-500 bg-emerald-50 border-emerald-200',
      role: 'NoSQL Database',
      desc: 'Stores CampusFind-Items (GSI on type and createdAt for sub-second feed lookups), CampusFind-Alerts, and subscriber registries.'
    },
    {
      name: 'Amazon SNS & SES',
      icon: Bell,
      color: 'text-purple-500 bg-purple-50 border-purple-200',
      role: 'Emergency Broadcast & Email Dispatch',
      desc: 'Publishes instant emergency broadcasts via verified email fan-out and real-time in-app banner push to all registered students.'
    },
    {
      name: 'Amazon API Gateway',
      icon: Cloud,
      color: 'text-teal-500 bg-teal-50 border-teal-200',
      role: 'RESTful API Management',
      desc: 'Exposes secure, CORS-enabled endpoints (/items, /items/{id}/matches, /alerts) protected by Cognito authorizer tokens.'
    },
    {
      name: 'Amazon Cognito',
      icon: ShieldCheck,
      color: 'text-indigo-500 bg-indigo-50 border-indigo-200',
      role: 'Student Auth & Role RBAC',
      desc: 'Campus email authentication pool with dedicated "Admin" and "Security" user pool groups restricting emergency broadcasts.'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-md">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">FindIt VITC — AWS Cloud Architecture</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Fully serverless cloud implementation on Amazon Web Services</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200 text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Full-Stack Cloud-Native Architecture</span>
            </div>
            <p>
              FindIt VITC uses an event-driven serverless pipeline: uploaded photos in S3 trigger Rekognition labels;
              Lambda computes 4-way match scores and persists to DynamoDB; security personnel broadcast alerts to SNS topic.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {services.map((srv, idx) => {
              const Icon = srv.icon;
              return (
                <div key={idx} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 hover:border-blue-300 dark:hover:border-blue-600 transition hover:shadow-sm bg-white dark:bg-slate-800/80">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-lg border ${srv.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{srv.name}</h4>
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{srv.role}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{srv.desc}</p>
                </div>
              );
            })}
          </div>

          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-200 space-y-1.5">
            <h4 className="font-bold text-sm text-blue-950 dark:text-blue-100">Infrastructure as Code (IaC) Ready:</h4>
            <p>
              Check <code className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 font-mono">infrastructure/template.yaml</code> for the complete AWS SAM template.
              Run <code className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 font-mono">sam deploy --guided</code> or <code className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 font-mono">deploy.ps1</code> to provision in your AWS account.
            </p>
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-medium text-xs transition"
          >
            Close Architecture View
          </button>
        </div>
      </div>
    </div>
  );
};
